import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { ObjectiveDetail } from "@/components/dashboard/objective-detail";
import { prisma } from "@/lib/db";

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const session = await getAuthSession();

  if (!session?.user?.email && !session?.user?.id) {
    return notFound();
  }

  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
    include: {
      couple: {
        include: {
          objectives: {
            where: { id: resolvedParams.id, archivedAt: null },
            include: {
              quarter: true,
              keyResults: {
                where: { archivedAt: null },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const objective = user?.couple?.objectives?.[0];

  if (!objective) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurueck zum Dashboard
        </Link>

        <div className="mt-6">
          <ObjectiveDetail
            objectiveId={objective.id}
            title={objective.title}
            description={objective.description}
            quarterTitle={objective.quarter.title}
            keyResults={objective.keyResults.map((keyResult) => ({
              id: keyResult.id,
              title: keyResult.title,
              currentValue: keyResult.currentValue,
              targetValue: keyResult.targetValue,
              unit: keyResult.unit,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
