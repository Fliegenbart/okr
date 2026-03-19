import Link from "next/link";

import { getAuthSession } from "@/auth";
import { VisionMissionForm } from "@/components/dashboard/vision-mission-form";
import { Card, CardContent } from "@/components/ui/card";
import {
  redirectForMissingCouple,
  requireDashboardSubpageAccess,
} from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

export default async function VisionMissionPage() {
  const session = await getAuthSession();
  requireDashboardSubpageAccess(session, "/dashboard/vision-mission");

  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
    include: {
      couple: true,
    },
  });

  if (!user?.couple) {
    redirectForMissingCouple(session);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/settings"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zu den Einstellungen
        </Link>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Vision & Mission
          </h1>
          <p className="text-sm text-muted-foreground">
            Ein kurzer Check-in, der euch emotional verankert.
          </p>
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="p-6">
            <VisionMissionForm
              initialVision={user.couple.vision}
              initialMission={user.couple.mission}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
