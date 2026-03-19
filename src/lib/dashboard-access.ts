import type { Session } from "next-auth";
import { redirect } from "next/navigation";

type DashboardSubpageSession = Session & {
  user: NonNullable<Session["user"]> & {
    coupleId: string;
    role?: "USER" | "ADMIN";
  };
};

function hasUserIdentity(session: Session | null) {
  return Boolean(session?.user?.id || session?.user?.email);
}

export function requireDashboardSubpageAccess(
  session: Session | null,
  pathname: string
): asserts session is DashboardSubpageSession {
  if (!hasUserIdentity(session)) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  if (!session?.user?.coupleId) {
    if (session?.user?.role === "ADMIN") {
      redirect("/admin");
    }

    redirect("/dashboard");
  }
}

export function redirectForMissingCouple(session: Session | null): never {
  if (session?.user?.role === "ADMIN") {
    redirect("/admin");
  }

  redirect("/dashboard");
}
