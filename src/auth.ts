import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";

import { canEmailSignIn } from "@/lib/beta-access";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendLoginLinkEmail } from "@/lib/email";
import { logEvent } from "@/lib/monitoring";
import { assertRateLimit } from "@/lib/rate-limit";
import { isDevLoginEnabled } from "@/lib/runtime-flags";

const enableDevLogin = isDevLoginEnabled();
const enableEmailProvider = isEmailConfigured();

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
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
  ],
  callbacks: {
    async signIn({ user, account, email }) {
      const provider = account?.provider ?? "";

      if (provider === "dev-login") {
        return enableDevLogin;
      }

      if (provider !== "email") {
        return false;
      }

      const normalizedEmail = normalizeEmail(
        user?.email ?? account?.providerAccountId ?? null
      );

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
        } catch {
          return "/auth/signin?error=RateLimit";
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
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.coupleId = user.coupleId ?? null;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = user?.id ?? token?.sub ?? session.user.id ?? "";
        session.user.coupleId =
          user?.coupleId ?? (token?.coupleId as string | null) ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};

export const getAuthSession = () => getServerSession(authOptions);

export const authHandler = NextAuth(authOptions);
