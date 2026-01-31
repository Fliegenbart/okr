import Image from "next/image";
import Link from "next/link";

import { getAuthSession } from "@/auth";
import { DashboardHeaderNav } from "@/components/dashboard/dashboard-header-nav";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export async function DashboardHeader() {
  const session = await getAuthSession();
  const userId = session?.user?.id ?? undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (!userId && !userEmail) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: userEmail },
    select: {
      couple: {
        select: {
          name: true,
        },
      },
    },
  });

  const coupleName = user?.couple?.name ?? "OKR fuer Paare";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="relative h-8 w-10">
              <Image
                src="/logo.png"
                alt="OKR fuer Paare"
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
            { href: "/dashboard/thinking-partner", label: "Thinking Partner" },
            { href: "/dashboard/vision-mission", label: "Vision & Mission" },
            { href: "/dashboard/settings", label: "Einstellungen" },
          ]}
        />

        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/objectives/new">
              Objective erstellen
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
