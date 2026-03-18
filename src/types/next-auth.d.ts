import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      coupleId: string | null;
      role: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    coupleId: string | null;
    role: "USER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    coupleId?: string | null;
    role?: "USER" | "ADMIN";
  }
}
