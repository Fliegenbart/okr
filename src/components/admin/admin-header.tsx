import Image from "next/image";
import Link from "next/link";

import { stopAdminCouplePreview } from "@/actions/admin";
import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardHeaderNav } from "@/components/dashboard/dashboard-header-nav";
import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/lib/admin";

type AdminHeaderProps = {
  user: AdminUser;
  previewCouple: {
    id: string;
    name: string;
  } | null;
};

export function AdminHeader({ user, previewCouple }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="relative h-8 w-10">
              <Image
                src="/logo.png"
                alt="OKR für Paare Admin"
                fill
                sizes="40px"
                className="object-contain"
              />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Admin Console</span>
              <span className="text-xs text-muted-foreground">{user.email ?? "ohne E-Mail"}</span>
            </div>
          </Link>
        </div>

        <DashboardHeaderNav
          className="flex-wrap gap-2"
          items={[
            { href: "/admin", label: "Overview" },
            { href: "/admin/beta", label: "Beta" },
            { href: "/admin/invites", label: "Invites" },
            { href: "/admin/couples", label: "Couples" },
            { href: "/admin/boards", label: "Boards" },
            { href: "/admin/ai", label: "AI Ops" },
            { href: "/admin/audit", label: "Audit" },
          ]}
        />

        <div className="flex items-center gap-2">
          {previewCouple ? (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Preview: {previewCouple.name}
            </span>
          ) : null}
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {user.role}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">
              {previewCouple ? "Zum Paar-Dashboard" : "Zur App"}
            </Link>
          </Button>
          {previewCouple ? (
            <form action={stopAdminCouplePreview}>
              <input type="hidden" name="redirectTo" value="/admin/couples" />
              <Button size="sm" variant="secondary" type="submit">
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
