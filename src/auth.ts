import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";

import { canEmailSignIn } from "@/lib/beta-access";
import { isAdminEmail } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import "@/lib/env";
import { claimInviteByToken } from "@/lib/invite-access";
import { isEmailConfigured, sendLoginLinkEmail } from "@/lib/email";
import { logEvent } from "@/lib/monitoring";
import { RateLimitError, assertRateLimit } from "@/lib/rate-limit";
import { authorizeSupportLogin, isSupportAccessConfigured } from "@/lib/support-access";
import { isDevLoginEnabled } from "@/lib/runtime-flags";

const enableDevLogin = isDevLoginEnabled();
const enableEmailProvider = isEmailConfigured();
const demoLoginEmails = new Set(["demo1@example.com", "demo2@example.com"]);

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

async function assertCredentialLoginRateLimit({ action, key }: { action: string; key: string }) {
  await assertRateLimit({
    action,
    key,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    ...(enableEmailProvider
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
              auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              },
            },
            from: process.env.EMAIL_FROM,
            async sendVerificationRequest({ identifier, url }) {
              try {
                await sendLoginLinkEmail(identifier, url);
                logEvent("info", "auth_magic_link_sent", { email: identifier });
              } catch (error) {
                logEvent("error", "auth_magic_link_send_failed", {
                  email: identifier,
                  message: error instanceof Error ? error.message : "unknown",
                });
                throw error;
              }
            },
          }),
        ]
      : []),
    ...(enableDevLogin
      ? [
          CredentialsProvider({
            id: "dev-login",
            name: "Developer Login",
            credentials: {
              email: {
                label: "Email",
                type: "email",
                placeholder: "dev@example.com",
              },
            },
            async authorize(credentials) {
              const email = credentials?.email?.toLowerCase().trim();
              if (!email) return null;

              const user = await prisma.user.upsert({
                where: { email },
                update: {},
                create: {
                  email,
                  emailVerified: new Date(),
                },
              });

              return user;
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "demo-login",
      name: "Demo Login",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "demo1@example.com",
        },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();

        if (!email || !demoLoginEmails.has(email)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            coupleId: true,
          },
        });

        if (!user?.coupleId) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { preferredQuarterId: null },
        });

        return user;
      },
    }),
    CredentialsProvider({
      id: "invite-login",
      name: "Invite Login",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "partner@email.de",
        },
        token: {
          label: "Token",
          type: "text",
          placeholder: "Einladungstoken",
        },
      },
      async authorize(credentials) {
        const token = credentials?.token?.trim();

        if (!token) return null;

        await assertCredentialLoginRateLimit({
          action: "auth_invite_login",
          key: token.slice(0, 24),
        });

        return claimInviteByToken(token);
      },
    }),
    ...(isSupportAccessConfigured()
      ? [
          CredentialsProvider({
            id: "support-login",
            name: "Support Login",
            credentials: {
              email: {
                label: "Email",
                type: "email",
                placeholder: "mail@davidwegener.de",
              },
              accessCode: {
                label: "Support Code",
                type: "password",
                placeholder: "Support-Code",
              },
            },
            async authorize(credentials) {
              const email = credentials?.email?.toLowerCase().trim();
              const accessCode = credentials?.accessCode?.trim();

              if (!email || !accessCode) return null;

              await assertCredentialLoginRateLimit({
                action: "auth_support_login",
                key: email,
              });

              return authorizeSupportLogin({ email, accessCode });
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, email }) {
      const provider = account?.provider ?? "";

      if (provider === "dev-login") {
        return enableDevLogin;
      }

      if (provider === "demo-login") {
        return true;
      }

      if (provider === "invite-login" || provider === "support-login") {
        return true;
      }

      if (provider !== "email") {
        return false;
      }

      const normalizedEmail = normalizeEmail(user?.email ?? account?.providerAccountId ?? null);

      if (!normalizedEmail) {
        return "/auth/signin?error=MissingEmail";
      }

      if (email?.verificationRequest) {
        try {
          await assertRateLimit({
            action: "auth_magic_link_request",
            key: normalizedEmail,
            limit: 5,
            windowMs: 15 * 60 * 1000,
          });
        } catch (error) {
          if (error instanceof RateLimitError) {
            return "/auth/signin?error=RateLimit";
          }

          logEvent("error", "auth_magic_link_rate_limit_check_failed", {
            email: normalizedEmail,
            message: error instanceof Error ? error.message : "unknown",
          });
          throw error;
        }

        const allowed = await canEmailSignIn(normalizedEmail);

        if (!allowed) {
          logEvent("warn", "auth_magic_link_denied", {
            email: normalizedEmail,
          });
          return "/auth/signin?error=BetaAccessRequired";
        }

        logEvent("info", "auth_magic_link_requested", {
          email: normalizedEmail,
        });

        return true;
      }

      const allowed = await canEmailSignIn(normalizedEmail);

      if (!allowed) {
        return "/auth/signin?error=BetaAccessRequired";
      }

      logEvent("info", "auth_sign_in_completed", {
        email: normalizedEmail,
        provider,
      });

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        const currentRole = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
        const shouldBeAdmin = isAdminEmail(user.email);

        if (shouldBeAdmin && currentRole !== "ADMIN") {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" },
          });
          logEvent("info", "auth_admin_role_granted", { userId: user.id, email: user.email });
        }

        token.sub = user.id;
        token.coupleId = user.coupleId ?? null;
        token.role = shouldBeAdmin ? "ADMIN" : currentRole;
        return token;
      }

      // Backfill for sessions issued before coupleId/role were stored in the JWT.
      // Runs at most once per legacy session; new sessions hit the branch above.
      const hasCoupleId = Object.prototype.hasOwnProperty.call(token, "coupleId");
      const hasRole = Object.prototype.hasOwnProperty.call(token, "role");
      if (token.sub && (!hasCoupleId || !hasRole || trigger === "update")) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { coupleId: true, role: true },
        });
        token.coupleId = dbUser?.coupleId ?? null;
        token.role = dbUser?.role ?? "USER";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.sub as string | undefined) ?? "";
        session.user.coupleId = (token.coupleId as string | null | undefined) ?? null;
        session.user.role = (token.role as "USER" | "ADMIN" | undefined) ?? "USER";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};

export const getAuthSession = () => getServerSession(authOptions);

export const authHandler = NextAuth(authOptions);
