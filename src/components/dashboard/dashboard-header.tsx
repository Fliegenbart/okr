import Image from "next/image";
import Link from "next/link";

import { stopAdminCouplePreview } from "@/actions/admin";
import { getAuthSession } from "@/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardHeaderNav } from "@/components/dashboard/dashboard-header-nav";
import { Button } from "@/components/ui/button";
import { getActiveCoupleSummary, getAuthenticatedViewer } from "@/lib/active-couple";
import { isAdminEmail } from "@/lib/admin-access";

export async function DashboardHeader() {
  const session = await getAuthSession();

  if (!session?.user?.id && !session?.user?.email) {
    return null;
  }

  const user = await getAuthenticatedViewer();
  const activeCouple = await getActiveCoupleSummary(user);

  const coupleName = activeCouple?.name ?? "OKR für Paare";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="relative h-8 w-10">
              <Image
                src="/logo.png"
                alt="OKR für Paare"
                fill
                sizes="40px"
                className="object-contain"
              />
            </span>
            <span className="text-sm font-semibold text-foreground">
              {coupleName}
            </span>
          </Link>
        </div>

        <DashboardHeaderNav
          className="flex-wrap gap-2"
        items={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/check-in", label: "Check-in" },
          { href: "/dashboard/timeline", label: "Timeline" },
          { href: "/dashboard/board", label: "Board" },
          { href: "/dashboard/templates", label: "Templates" },
          { href: "/dashboard/reminders", label: "Reminder" },
          { href: "/dashboard/thinking-partner", label: "Thinking Partner" },
          { href: "/dashboard/vision-mission", label: "Vision & Mission" },
          ...(user?.role === "ADMIN" || isAdminEmail(user?.email)
            ? [{ href: "/admin", label: "Admin" }]
            : []),
          { href: "/dashboard/settings", label: "Einstellungen" },
        ]}
      />

        <div className="flex items-center gap-2">
          {user?.isPreviewingCouple ? (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Admin Preview
            </span>
          ) : null}
          <Button asChild size="sm">
            <Link href="/dashboard/objectives/new">
              Objective erstellen
            </Link>
          </Button>
          {user?.isPreviewingCouple ? (
            <form action={stopAdminCouplePreview}>
              <input type="hidden" name="redirectTo" value="/admin/couples" />
              <Button size="sm" variant="outline" type="submit">
                Preview beenden
              </Button>
            </form>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
