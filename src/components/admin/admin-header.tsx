"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { stopAdminCouplePreview } from "@/actions/admin";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/lib/admin";

type AdminHeaderProps = {
  user: AdminUser;
  previewCouple: {
    id: string;
    name: string;
  } | null;
};

const navItems = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/beta", label: "Beta" },
  { href: "/admin/invites", label: "Einladungen" },
  { href: "/admin/couples", label: "Paare" },
  { href: "/admin/boards", label: "Boards" },
  { href: "/admin/ai", label: "KI" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminHeader({ user, previewCouple }: AdminHeaderProps) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);

  const currentLabel = useMemo(() => {
    return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ?.label;
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-7xl px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="min-w-0 flex items-center gap-3">
            <span className="relative h-8 w-10 flex-none">
              <Image
                src="/logo.png"
                alt="OKR für Paare Admin"
                fill
                sizes="40px"
                className="object-contain"
              />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">Admin-Bereich</span>
                {currentLabel ? (
                  <span className="hidden rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
                    {currentLabel}
                  </span>
                ) : null}
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {user.email ?? "ohne E-Mail"}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {previewCouple ? (
              <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary md:inline-flex">
                Ansicht: {previewCouple.name}
              </span>
            ) : null}
            <span className="hidden rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground sm:inline-flex">
              {user.role}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Admin-Menü schließen" : "Admin-Menü öffnen"}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <div className="mt-4 grid gap-4 rounded-3xl border border-border bg-white p-4 shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Bereiche
              </p>
              <nav className="grid gap-2 sm:grid-cols-2">
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground",
                        isActive && "border-border bg-muted/50 text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Aktionen
              </p>
              <div className="flex flex-col gap-2">
                {previewCouple ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary md:hidden">
                    Ansicht: {previewCouple.name}
                  </div>
                ) : null}
                <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground sm:hidden">
                  Rolle: <span className="font-semibold">{user.role}</span>
                </div>
                <Button asChild variant="outline" className="justify-start rounded-2xl">
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                    {previewCouple ? "Zum Paar-Dashboard" : "Zur App"}
                  </Link>
                </Button>
                {previewCouple ? (
                  <form action={stopAdminCouplePreview}>
                    <input type="hidden" name="redirectTo" value="/admin/couples" />
                    <Button className="w-full justify-start rounded-2xl" variant="secondary" type="submit">
                      Ansicht beenden
                    </Button>
                  </form>
                ) : null}
                <div className="pt-1">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
