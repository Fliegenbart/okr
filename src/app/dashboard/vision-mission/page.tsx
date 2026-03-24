import Link from "next/link";

import { VisionMissionForm } from "@/components/dashboard/vision-mission-form";
import { Card, CardContent } from "@/components/ui/card";
import { redirectForMissingCouple, requireDashboardSubpageAccess } from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

export default async function VisionMissionPage() {
  const viewer = await requireDashboardSubpageAccess("/dashboard/vision-mission");

  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    select: {
      name: true,
      avatarImage: true,
      vision: true,
      mission: true,
    },
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="dashboard-shell mx-auto w-full max-w-[1200px] px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6 space-y-3">
          <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Foundation</p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.05em] text-foreground">
            Vision & Mission
          </h1>
          <p className="text-sm text-muted-foreground">
            Haltet hier einfach fest, was euch wichtig ist und wie ihr leben wollt.
          </p>
        </div>

        <Card className="mt-8 rounded-[2rem] border-white/70">
          <CardContent className="p-6">
            <VisionMissionForm
              initialVision={couple.vision}
              initialMission={couple.mission}
              initialAvatarImage={couple.avatarImage}
              coupleName={couple.name}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
