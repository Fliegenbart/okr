import type { ReactNode } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import { requireAdminUser } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdminUser();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(242,0,128,0.08),_transparent_30%),linear-gradient(180deg,_#faf7fb_0%,_#ffffff_25%)]">
      <AdminHeader user={user} />
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

