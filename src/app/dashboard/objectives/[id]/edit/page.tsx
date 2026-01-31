import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { KeyResultCreateForm } from "@/components/dashboard/key-result-create-form";
import { KeyResultEditItem } from "@/components/dashboard/key-result-edit-item";
import { KeyResultRestoreButton } from "@/components/dashboard/key-result-restore-button";
import { ObjectiveDeleteCard } from "@/components/dashboard/objective-delete-card";
import { ObjectiveEditForm } from "@/components/dashboard/objective-edit-form";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

export default async function ObjectiveEditPage({
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
          quarters: {
            orderBy: { startsAt: "desc" },
          },
          objectives: {
            where: { id: resolvedParams.id, archivedAt: null },
            include: { keyResults: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });

  const objective = user?.couple?.objectives?.[0];
  const activeKeyResults = objective?.keyResults.filter(
    (keyResult) => !keyResult.archivedAt
  );
  const archivedKeyResults = objective?.keyResults.filter(
    (keyResult) => keyResult.archivedAt
  );
  const keyResultLimitReached = (activeKeyResults?.length ?? 0) >= 6;

  if (!user?.couple || !objective) {
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

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Objective bearbeiten
          </h1>
          <p className="text-sm text-muted-foreground">
            Passe Objective und Key Results an.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Objective Details
              </p>
              <ObjectiveEditForm
                objectiveId={objective.id}
                title={objective.title}
                description={objective.description}
                quarterId={objective.quarterId}
                quarters={user.couple.quarters.map((quarter) => ({
                  id: quarter.id,
                  title: quarter.title,
                }))}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Neues Key Result
              </p>
              <KeyResultCreateForm
                objectiveId={objective.id}
                disabled={keyResultLimitReached}
                disabledReason="Maximal 6 Key Results pro Objective."
              />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">
              Key Results bearbeiten
            </p>
            <div className="space-y-4">
              {activeKeyResults?.map((keyResult) => (
                <KeyResultEditItem
                  key={keyResult.id}
                  keyResultId={keyResult.id}
                  title={keyResult.title}
                  targetValue={keyResult.targetValue}
                  unit={keyResult.unit}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {archivedKeyResults?.length ? (
          <Card className="mt-8 rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Archivierte Key Results
              </p>
              <div className="space-y-3">
                {archivedKeyResults.map((keyResult) => (
                  <div
                    key={keyResult.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {keyResult.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ziel: {keyResult.targetValue}
                        {keyResult.unit ? ` ${keyResult.unit}` : ""}
                      </p>
                    </div>
                    <KeyResultRestoreButton keyResultId={keyResult.id} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">
              Danger Zone
            </p>
            <ObjectiveDeleteCard objectiveId={objective.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
