import Link from "next/link";

import { VisionMissionForm } from "@/components/dashboard/vision-mission-form";
import { Card, CardContent } from "@/components/ui/card";
import {
  redirectForMissingCouple,
  requireDashboardSubpageAccess,
} from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

export default async function VisionMissionPage() {
  const viewer = await requireDashboardSubpageAccess("/dashboard/vision-mission");

  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    select: {
      vision: true,
      mission: true,
    },
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
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
              initialVision={couple.vision}
              initialMission={couple.mission}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
