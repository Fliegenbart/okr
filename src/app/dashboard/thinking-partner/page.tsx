import Link from "next/link";

import { ThinkingPartnerChat } from "@/components/dashboard/thinking-partner-chat";
import { Card, CardContent } from "@/components/ui/card";
import { redirectForMissingCouple, requireDashboardSubpageAccess } from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

export default async function ThinkingPartnerPage({
  searchParams,
}: {
  searchParams?: Promise<{ objectiveId?: string; keyResultId?: string }>;
}) {
  const viewer = await requireDashboardSubpageAccess("/dashboard/thinking-partner");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const objectiveId = resolvedSearchParams?.objectiveId ?? null;
  const keyResultId = resolvedSearchParams?.keyResultId ?? null;

  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    select: { id: true },
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
  }

  const objective = objectiveId
    ? await prisma.objective.findFirst({
        where: { id: objectiveId, coupleId: couple.id },
        select: { title: true },
      })
    : null;

  const keyResult = keyResultId
    ? await prisma.keyResult.findFirst({
        where: {
          id: keyResultId,
          archivedAt: null,
          objective: { coupleId: couple.id, archivedAt: null },
        },
        select: { title: true },
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">OKR-Coach</h1>
          <p className="text-sm text-muted-foreground">
            Hier sortiert ihr Vision, Mission, Strategiefelder, Objectives und Key Results und
            findet den nächsten sinnvollen Schritt.
          </p>
          {objective ? (
            <p className="text-sm text-muted-foreground">
              Gerade im Blick: <span className="font-medium">{objective.title}</span>
            </p>
          ) : null}
          {keyResult ? (
            <p className="text-sm text-muted-foreground">
              Gerade im Blick: <span className="font-medium">{keyResult.title}</span>
            </p>
          ) : null}
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="p-6">
            <ThinkingPartnerChat objectiveId={objectiveId} keyResultId={keyResultId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
