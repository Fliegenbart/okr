import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { VisionMissionForm } from "@/components/dashboard/vision-mission-form";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

export default async function VisionMissionPage() {
  const session = await getAuthSession();

  if (!session?.user?.email && !session?.user?.id) {
    return notFound();
  }

  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
    include: {
      couple: true,
    },
  });

  if (!user?.couple) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/settings"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurueck zu den Einstellungen
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
