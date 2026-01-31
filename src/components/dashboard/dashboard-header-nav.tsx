"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
};

type DashboardHeaderNavProps = {
  items: NavItem[];
  className?: string;
};

export function DashboardHeaderNav({
  items,
  className,
}: DashboardHeaderNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav className={cn("flex items-center gap-2", className)}>
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-white/70 hover:text-foreground",
              isActive && "bg-white/80 text-foreground shadow-sm"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
