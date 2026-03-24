import Link from "next/link";
import { redirect } from "next/navigation";

import { CollapsibleGrid } from "@/components/dashboard/collapsible-grid";
import { ObjectiveCard } from "@/components/dashboard/objective-card";
import { ObjectiveProgressMiniChart } from "@/components/dashboard/objective-progress-mini-chart";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { PowerMoveCard } from "@/components/dashboard/power-move-card";
import { ProgressDonut } from "@/components/dashboard/progress-donut";
import { QuarterProgressChart } from "@/components/dashboard/quarter-progress-chart";
import { QuarterFilter } from "@/components/dashboard/quarter-filter";
import { VisionHeader } from "@/components/dashboard/vision-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthenticatedViewer } from "@/lib/active-couple";
import { canEmailCreateCouple } from "@/lib/beta-access";
import { prisma } from "@/lib/db";
import { getObjectiveInsights } from "@/lib/insights";
import { calculateProgress } from "@/lib/progress";
import { buildQuarterProgressSnapshot } from "@/lib/quarter-progress";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ quarter?: string; invite?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const viewer = await getAuthenticatedViewer();

  if (!viewer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-lg font-semibold text-foreground">Bitte startet noch einmal von vorne</p>
            <p className="text-sm text-muted-foreground">
              Eure Sitzung ist abgelaufen oder noch nicht aktiv.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Zur Startseite
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  if (!viewer.activeCoupleId) {
    if (viewer.role === "ADMIN") {
      redirect("/admin/couples");
    }

    const canCreateCouple = viewer.email ? await canEmailCreateCouple(viewer.email) : false;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <OnboardingCard
          userEmail={viewer.email}
          initialInviteToken={resolvedSearchParams?.invite}
          canCreateCouple={canCreateCouple}
        />
      </div>
    );
  }

  const [couple, userPreferences] = await Promise.all([
    prisma.couple.findUnique({
      where: { id: viewer.activeCoupleId },
      include: {
        users: {
          select: { id: true },
        },
        invites: {
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: "desc" },
        },
        objectives: {
          where: { archivedAt: null },
          include: {
            keyResults: {
              where: { archivedAt: null },
              include: {
                updates: {
                  select: {
                    value: true,
                    previousValue: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        quarters: {
          orderBy: { startsAt: "desc" },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: viewer.id },
      select: { preferredQuarterId: true },
    }),
  ]);

  if (!couple) {
    if (viewer.role === "ADMIN") {
      redirect("/admin/couples");
    }

    redirect("/dashboard");
  }

  const activeQuarter =
    couple.quarters.find((quarter) => quarter.startsAt <= now && quarter.endsAt >= now) ??
    couple.quarters[0];
  const preferredQuarterId =
    viewer.userCoupleId === viewer.activeCoupleId
      ? (userPreferences?.preferredQuarterId ?? null)
      : null;
  const selectedQuarterId = resolvedSearchParams?.quarter ?? preferredQuarterId ?? "all";
  const filteredObjectives =
    selectedQuarterId === "all"
      ? couple.objectives
      : couple.objectives.filter((objective) => objective.quarterId === selectedQuarterId);

  const selectedQuarter =
    selectedQuarterId === "all"
      ? (activeQuarter ?? null)
      : (couple.quarters.find((quarter) => quarter.id === selectedQuarterId) ??
        activeQuarter ??
        null);
  const quarterProgressObjectives = selectedQuarter
    ? couple.objectives.filter((objective) => objective.quarterId === selectedQuarter.id)
    : [];
  const quarterProgressSnapshot = selectedQuarter
    ? buildQuarterProgressSnapshot({
        quarter: selectedQuarter,
        objectives: quarterProgressObjectives.map((objective) => ({
          id: objective.id,
          title: objective.title,
          createdAt: objective.createdAt,
          keyResults: objective.keyResults.map((keyResult) => ({
            id: keyResult.id,
            currentValue: keyResult.currentValue,
            targetValue: keyResult.targetValue,
            startValue: keyResult.startValue,
            type: keyResult.type,
            direction: keyResult.direction,
            redThreshold: keyResult.redThreshold,
            yellowThreshold: keyResult.yellowThreshold,
            greenThreshold: keyResult.greenThreshold,
            updates: keyResult.updates.map((update) => ({
              value: update.value,
              previousValue: update.previousValue,
              createdAt: update.createdAt,
            })),
          })),
        })),
        now,
      })
    : null;

  const objectiveProgressValues = filteredObjectives.map((objective) =>
    calculateProgress(
      objective.keyResults.map((keyResult) => ({
        currentValue: keyResult.currentValue,
        targetValue: keyResult.targetValue,
        startValue: keyResult.startValue,
        type: keyResult.type,
        direction: keyResult.direction,
        redThreshold: keyResult.redThreshold,
        yellowThreshold: keyResult.yellowThreshold,
        greenThreshold: keyResult.greenThreshold,
      }))
    )
  );
  const averageProgress = objectiveProgressValues.length
    ? Math.round(
        objectiveProgressValues.reduce((sum, value) => sum + value, 0) /
          objectiveProgressValues.length
      )
    : 0;

  const objectiveCards = filteredObjectives.map((objective) => {
    const insights = getObjectiveInsights(
      objective.keyResults.flatMap((keyResult) => keyResult.updates)
    );

    return {
      id: objective.id,
      title: objective.title,
      description: objective.description,
      nextAction: objective.nextAction,
      keyResults: objective.keyResults.map((keyResult) => ({
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
      })),
      insights: {
        ...insights,
        lastUpdateAt: insights.lastUpdateAt ? insights.lastUpdateAt.toISOString() : null,
      },
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <VisionHeader
          vision={couple.vision}
          coupleName={couple.name}
          avatarImage={couple.avatarImage}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="dashboard-panel rounded-[1.75rem] border-border/70">
              <CardContent className="space-y-4 p-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Aktuelles Quartal
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Euer gemeinsamer Fokus fuer die aktuelle Etappe.
                  </p>
                </div>
                {activeQuarter ? (
                  <>
                    <p className="text-2xl font-semibold text-foreground">{activeQuarter.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {dateFormatter.format(activeQuarter.startsAt)} –{" "}
                      {dateFormatter.format(activeQuarter.endsAt)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch kein Quartal angelegt.</p>
                )}
              </CardContent>
            </Card>

            <Card className="dashboard-panel rounded-[1.75rem] border-border/70">
              <CardContent className="flex h-full flex-col items-start gap-4 p-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Euer Gesamtstand
                  </p>
                  <p className="text-xs text-muted-foreground">
                    So weit seid ihr im Schnitt ueber alle Objectives.
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <ProgressDonut
                    value={averageProgress}
                    size={108}
                    strokeWidth={8}
                    showValue={true}
                    showLabel={false}
                    progressClassName="text-primary"
                    valueClassName="text-xl"
                  />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {filteredObjectives.length} aktive Objectives
                    </p>
                    <p>Der Durchschnitt aktualisiert sich aus euren aktuellen Key Results.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-panel rounded-[1.75rem] border-border/70 md:col-span-2">
              <CardContent className="space-y-4 p-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Schnell starten
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Die wichtigsten Wege fuer euren naechsten Schritt.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Link
                    href="/dashboard/objectives/new"
                    className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                  >
                    Objective anlegen
                  </Link>
                  <Link
                    href="/dashboard/check-in"
                    className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
                  >
                    Wochen-Check oeffnen
                  </Link>
                  <Link
                    href="/dashboard/vision-mission"
                    className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
                  >
                    Vision + Mission oeffnen
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <PowerMoveCard
            quarterId={selectedQuarter?.id ?? null}
            quarterTitle={selectedQuarter?.title ?? activeQuarter?.title ?? null}
            hasObjectives={filteredObjectives.length > 0}
          />
        </div>

        <section className="mt-10 space-y-4" data-testid="quarter-progress-section">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Fortschritt im Quartal
            </p>
            <h2 className="text-2xl font-semibold text-foreground">Euer Score im Quartal</h2>
            <p className="text-sm text-muted-foreground">
              Hier seht ihr, wie sich eure Objectives im laufenden Quartal entwickeln.
            </p>
            <p className="text-xs text-muted-foreground">
              Pink zeigt euren echten Stand. Die gestrichelte Linie zeigt, wo ihr heute idealerweise
              stehen würdet.
            </p>
          </div>

          {quarterProgressSnapshot ? (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.35fr,0.65fr]">
                <Card className="dashboard-panel rounded-[1.75rem] border-border/70">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.22em] text-primary">
                          Bisheriger Verlauf
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="font-semibold text-foreground">
                            {quarterProgressSnapshot.quarterTitle}
                          </span>
                          <span className="text-muted-foreground">
                            {dateFormatter.format(new Date(quarterProgressSnapshot.quarterStartsAt))}{" "}
                            – {dateFormatter.format(new Date(quarterProgressSnapshot.quarterEndsAt))}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                          Ist
                        </span>
                        <span className="rounded-full border border-border bg-white px-3 py-1 font-medium text-muted-foreground">
                          Soll
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] bg-muted/35 p-4">
                      <QuarterProgressChart
                        data={quarterProgressSnapshot.aggregateSeries}
                        todayKey={quarterProgressSnapshot.todayKey}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="dashboard-panel rounded-[1.75rem] border-border/70">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Ueberblick</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-[1.5rem] border border-border/70 bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Durchschnitt
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.averageProgress}%
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/70 bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">Objectives</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.totalObjectives}
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/70 bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Ohne neuen Stand
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.objectivesWithoutUpdates}
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/70 bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Tage bis zum Ende
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.daysRemaining}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ihr seid an Tag {quarterProgressSnapshot.daysElapsed}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {quarterProgressSnapshot.objectiveSeries.length ? (
                <CollapsibleGrid
                  className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                  itemLabel="Objectives"
                >
                  {quarterProgressSnapshot.objectiveSeries.map((objective) => (
                    <ObjectiveProgressMiniChart
                      key={objective.id}
                      objective={objective}
                      href={`/dashboard/objectives/${objective.id}`}
                    />
                  ))}
                </CollapsibleGrid>
              ) : (
                <Card className="dashboard-panel rounded-[1.75rem] border-border/70">
                  <CardContent className="space-y-3 p-6">
                    <p className="text-lg font-semibold text-foreground">
                      Noch keine Objectives in diesem Quartal
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sobald ihr in {quarterProgressSnapshot.quarterTitle} das erste Objective anlegt,
                      erscheint hier der Verlauf.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="dashboard-panel rounded-[1.75rem] border-border/70">
              <CardContent className="space-y-3 p-6">
                <p className="text-lg font-semibold text-foreground">Noch kein Quartal vorhanden</p>
                <p className="text-sm text-muted-foreground">
                  Legt zuerst ein Quartal an. Danach zeigen wir euch, wie sich eure Objectives
                  entwickeln.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Objectives
              </p>
              <h2 className="text-2xl font-semibold text-foreground">Eure Objectives</h2>
            </div>
            <QuarterFilter
              selectedId={selectedQuarterId}
              options={couple.quarters.map((quarter) => ({
                id: quarter.id,
                title: quarter.title,
              }))}
            />
          </div>

          {objectiveCards.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <CollapsibleGrid className="grid gap-6 md:grid-cols-2" itemLabel="Objectives">
                  {objectiveCards.map((objective) => (
                    <ObjectiveCard
                      key={objective.id}
                      objectiveId={objective.id}
                      title={objective.title}
                      description={objective.description}
                      nextAction={objective.nextAction}
                      keyResults={objective.keyResults}
                      insights={objective.insights}
                    />
                  ))}
                </CollapsibleGrid>
              </div>
            </div>
          ) : (
            <Card className="dashboard-panel rounded-[1.75rem] border-border/70">
              <CardContent className="space-y-3 p-6">
                <p className="text-lg font-semibold text-foreground">Noch keine Objectives</p>
                <p className="text-sm text-muted-foreground">
                  Sobald ihr euer erstes Objective anlegt, erscheint es hier.
                </p>
                <Link
                  href="/dashboard/objectives/new"
                  className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  Objective anlegen
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
