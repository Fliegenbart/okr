import Image from "next/image";
import Link from "next/link";

import { stopAdminCouplePreview } from "@/actions/admin";
import { getAuthSession } from "@/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardHeaderNav } from "@/components/dashboard/dashboard-header-nav";
import { Button } from "@/components/ui/button";
import { getActiveCoupleSummary, getAuthenticatedViewer } from "@/lib/active-couple";

export async function DashboardHeader() {
  const session = await getAuthSession();

  if (!session?.user?.id && !session?.user?.email) {
    return null;
  }

  const user = await getAuthenticatedViewer();
  const activeCouple = await getActiveCoupleSummary(user);

  const coupleName = activeCouple?.name ?? "OKR für Paare";
  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/check-in", label: "Wochen-Check" },
    { href: "/dashboard/vision-mission", label: "Vision + Mission" },
  ];

  return (
    <header className="glass-card sticky top-0 z-40 border-b border-white/60 bg-white/72">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="relative h-9 w-11">
              <Image
                src="/logo.png"
                alt="OKR für Paare"
                fill
                sizes="44px"
                className="object-contain"
              />
            </span>
            <span className="font-display text-lg font-bold tracking-[-0.04em] text-foreground">
              {coupleName}
            </span>
          </Link>
        </div>

        <DashboardHeaderNav
          className="flex-wrap gap-2"
          items={navItems}
        />

        <div className="flex items-center gap-2">
          {user?.isPreviewingCouple ? (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Admin-Ansicht
            </span>
          ) : null}
          <Button
            asChild
            size="sm"
            className="dashboard-pill bg-primary px-5 text-white shadow-[0_16px_36px_rgba(193,0,103,0.18)]"
          >
            <Link href="/dashboard/objectives/new">Objective anlegen</Link>
          </Button>
          {user?.isPreviewingCouple ? (
            <form action={stopAdminCouplePreview}>
              <input type="hidden" name="redirectTo" value="/admin/couples" />
              <Button size="sm" variant="outline" type="submit">
                Ansicht beenden
              </Button>
            </form>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
