import Link from "next/link";
import { notFound } from "next/navigation";

import { ObjectiveDetail } from "@/components/dashboard/objective-detail";
import {
  redirectForMissingCouple,
  requireDashboardSubpageAccess,
} from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";
import { sortKeyResults } from "@/lib/sorting";

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const viewer = await requireDashboardSubpageAccess(`/dashboard/objectives/${resolvedParams.id}`);

  const objective = await prisma.objective.findFirst({
    where: { id: resolvedParams.id, coupleId: viewer.activeCoupleId, archivedAt: null },
    include: {
      quarter: true,
      commitments: {
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true, email: true } },
        },
      },
      keyResults: {
        where: { archivedAt: null },
        include: {
          updates: {
            select: {
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!objective) {
    const couple = await prisma.couple.findUnique({
      where: { id: viewer.activeCoupleId },
      select: { id: true },
    });

    if (!couple) {
      redirectForMissingCouple(viewer);
    }

    return notFound();
  }

  const sortedKeyResults = sortKeyResults(
    objective.keyResults,
    viewer.preferredKeyResultSort
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="dashboard-shell mx-auto w-full max-w-[1300px] px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6">
          <ObjectiveDetail
            objectiveId={objective.id}
            title={objective.title}
            description={objective.description}
            quarterTitle={objective.quarter.title}
            nextAction={objective.nextAction}
            keyResultSort={viewer.preferredKeyResultSort}
            keyResults={sortedKeyResults.map((keyResult) => ({
              id: keyResult.id,
              title: keyResult.title,
              currentValue: keyResult.currentValue,
              targetValue: keyResult.targetValue,
              startValue: keyResult.startValue,
              type: keyResult.type,
              direction: keyResult.direction,
              redThreshold: keyResult.redThreshold,
              yellowThreshold: keyResult.yellowThreshold,
              greenThreshold: keyResult.greenThreshold,
              unit: keyResult.unit,
            }))}
            commitments={objective.commitments.map((commitment) => ({
              id: commitment.id,
              title: commitment.title,
              status: commitment.status,
              dueAt: commitment.dueAt ? commitment.dueAt.toISOString() : null,
              ownerName:
                commitment.owner?.name ?? commitment.owner?.email ?? null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
