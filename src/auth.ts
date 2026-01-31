import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";

import { prisma } from "@/lib/db";

const enableDevLogin = process.env.DEV_LOGIN_ENABLED === "true";
const enableEmailProvider = Boolean(
  process.env.EMAIL_SERVER_HOST && process.env.EMAIL_FROM
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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
