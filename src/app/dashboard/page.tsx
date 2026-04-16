import Link from "next/link";
import { redirect } from "next/navigation";

import { CollapsibleGrid } from "@/components/dashboard/collapsible-grid";
import { ObjectiveCard } from "@/components/dashboard/objective-card";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { PowerMoveCard } from "@/components/dashboard/power-move-card";
import { QuarterProgressChart } from "@/components/dashboard/quarter-progress-chart";
import { QuarterFilter } from "@/components/dashboard/quarter-filter";
import { ObjectiveSortSelect } from "@/components/dashboard/sort-preference-select";
import { VisionHeader } from "@/components/dashboard/vision-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthenticatedViewer } from "@/lib/active-couple";
import { canEmailCreateCouple } from "@/lib/beta-access";
import { prisma } from "@/lib/db";
import { getObjectiveInsights } from "@/lib/insights";
import { calculateProgress } from "@/lib/progress";
import { buildQuarterProgressSnapshot } from "@/lib/quarter-progress";
import { sortKeyResults, sortObjectives } from "@/lib/sorting";

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

  const couple = await prisma.couple.findUnique({
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
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      quarters: {
        orderBy: { startsAt: "desc" },
      },
    },
  });

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
      ? (viewer.preferredQuarterId ?? null)
      : null;
  const objectiveSort = viewer.preferredObjectiveSort;
  const keyResultSort = viewer.preferredKeyResultSort;
  const selectedQuarterId = resolvedSearchParams?.quarter ?? preferredQuarterId ?? "all";
  const filteredObjectives =
    selectedQuarterId === "all"
      ? couple.objectives
      : couple.objectives.filter((objective) => objective.quarterId === selectedQuarterId);
  const sortedObjectives = sortObjectives(filteredObjectives, objectiveSort);

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

  const objectiveCards = sortedObjectives.map((objective) => {
    const sortedKeyResults = sortKeyResults(objective.keyResults, keyResultSort);
    const insights = getObjectiveInsights(
      objective.keyResults.flatMap((keyResult) => keyResult.updates)
    );
    const progressSeries =
      quarterProgressSnapshot?.objectiveSeries.find((series) => series.id === objective.id) ?? null;

    return {
      id: objective.id,
      title: objective.title,
      description: objective.description,
      nextAction: objective.nextAction,
      keyResults: sortedKeyResults.map((keyResult) => ({
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
      progressSeries,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="dashboard-shell mx-auto w-full max-w-[1400px] px-6 py-10">
        <VisionHeader
          vision={couple.vision}
          coupleName={couple.name}
          avatarImage={couple.avatarImage}
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.7fr,1fr]">
          <Card className="rounded-[2rem] border-white/70">
            <CardContent className="space-y-6 p-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="dashboard-kicker text-[10px] font-extrabold text-primary">
                      Aktuelles Quartal
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Der gemeinsame Fokusrahmen für eure nächsten Wochen.
                    </p>
                  </div>
                  {activeQuarter ? (
                    <>
                      <p className="font-display text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                        {activeQuarter.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {dateFormatter.format(activeQuarter.startsAt)} –{" "}
                        {dateFormatter.format(activeQuarter.endsAt)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Noch kein Quartal angelegt.</p>
                  )}
                </div>

                <div className="min-w-[180px] rounded-[1.6rem] bg-secondary/55 px-5 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:text-right">
                  <p className="dashboard-kicker text-[10px] font-extrabold text-primary/75">
                    Global Completion
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    So weit seid ihr in diesem Quartal im Schnitt.
                  </p>
                  <p className="mt-3 font-display text-4xl font-extrabold tracking-[-0.05em] text-foreground">
                    {averageProgress}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-highlight rounded-[2rem] border-none text-white shadow-[0_28px_70px_rgba(193,0,103,0.24)]">
            <CardContent className="space-y-5 p-7">
              <div className="space-y-2">
                <p className="dashboard-kicker text-[10px] font-extrabold text-white/65">Quick Actions</p>
                <h3 className="font-display text-3xl font-extrabold tracking-[-0.05em] text-white">
                  Schnell starten
                </h3>
                <p className="text-sm leading-6 text-white/80">
                  Die drei wichtigsten Einstiege für euren gemeinsamen Fortschritt in dieser Woche.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  href="/dashboard/objectives/new"
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-primary shadow-[0_14px_34px_rgba(38,17,33,0.12)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
                >
                  Objective anlegen
                </Link>
                <Link
                  href="/dashboard/check-in"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/16"
                >
                  Wochen-Check öffnen
                </Link>
                <Link
                  href="/dashboard/vision-mission"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/16"
                >
                  Vision + Mission öffnen
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {quarterProgressSnapshot ? (
          <section className="mt-6 space-y-4">
            <div className="space-y-1">
              <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Überblick</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Die wichtigsten Zahlen für dieses Quartal auf einen Blick.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="metric-glass rounded-[1.75rem] border-white/70">
                <CardContent className="p-5">
                  <p className="dashboard-kicker text-[10px] font-extrabold text-primary">
                    Durchschnitt
                  </p>
                  <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                    {quarterProgressSnapshot.averageProgress}%
                  </p>
                </CardContent>
              </Card>
              <Card className="metric-glass rounded-[1.75rem] border-white/70">
                <CardContent className="p-5">
                  <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Objectives</p>
                  <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                    {quarterProgressSnapshot.totalObjectives}
                  </p>
                </CardContent>
              </Card>
              <Card className="metric-glass rounded-[1.75rem] border-white/70">
                <CardContent className="p-5">
                  <p className="dashboard-kicker text-[10px] font-extrabold text-primary">
                    Ohne neuen Stand
                  </p>
                  <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                    {quarterProgressSnapshot.objectivesWithoutUpdates}
                  </p>
                </CardContent>
              </Card>
              <Card className="metric-glass rounded-[1.75rem] border-white/70">
                <CardContent className="p-5">
                  <p className="dashboard-kicker text-[10px] font-extrabold text-primary">
                    Tage bis Ende
                  </p>
                  <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                    {quarterProgressSnapshot.daysRemaining}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Tag {quarterProgressSnapshot.daysElapsed}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : null}

        <section className="mt-14 space-y-5" data-testid="quarter-progress-section">
          <div className="space-y-3">
            <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Performance Analytics</p>
            <h2 className="font-display text-4xl font-extrabold tracking-[-0.05em] text-foreground">
              Euer Score im Quartal
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Hier seht ihr, wie sich eure Objectives im laufenden Quartal entwickeln.
            </p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Pink zeigt euren echten Stand. Blau gestrichelt zeigt, wo ihr heute idealerweise
              stehen würdet.
            </p>
          </div>

          {quarterProgressSnapshot ? (
            <>
              <Card className="rounded-[2.25rem] border-white/70">
                <CardContent className="space-y-6 p-8">
                  <div className="space-y-1">
                    <p className="dashboard-kicker text-[10px] font-extrabold text-primary">
                      Bisheriger Verlauf
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-display text-2xl font-bold tracking-[-0.04em] text-foreground">
                        {quarterProgressSnapshot.quarterTitle}
                      </span>
                      <span className="text-muted-foreground">
                        {dateFormatter.format(new Date(quarterProgressSnapshot.quarterStartsAt))} –{" "}
                        {dateFormatter.format(new Date(quarterProgressSnapshot.quarterEndsAt))}
                      </span>
                    </div>
                  </div>

                  <QuarterProgressChart
                    data={quarterProgressSnapshot.aggregateSeries}
                    todayKey={quarterProgressSnapshot.todayKey}
                  />

                  <PowerMoveCard
                    quarterId={selectedQuarter?.id ?? null}
                    quarterTitle={quarterProgressSnapshot.quarterTitle}
                    hasObjectives={quarterProgressSnapshot.totalObjectives > 0}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-[2rem] border-white/70">
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

        <section className="mt-14 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Objectives</p>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                Eure Objectives
              </h2>
            </div>
            <div className="flex flex-col items-end gap-3">
              <ObjectiveSortSelect value={objectiveSort} />
              <QuarterFilter
                selectedId={selectedQuarterId}
                options={couple.quarters.map((quarter) => ({
                  id: quarter.id,
                  title: quarter.title,
                }))}
              />
            </div>
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
                      progressSeries={objective.progressSeries}
                      progressTodayKey={quarterProgressSnapshot?.todayKey ?? null}
                    />
                  ))}
                </CollapsibleGrid>
              </div>
            </div>
          ) : (
            <Card className="rounded-[2rem] border-white/70">
              <CardContent className="space-y-3 p-6">
                <p className="text-lg font-semibold text-foreground">Noch keine Objectives</p>
                <p className="text-sm text-muted-foreground">
                  Sobald ihr euer erstes Objective anlegt, erscheint es hier.
                </p>
                <Link
                  href="/dashboard/objectives/new"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(193,0,103,0.18)] transition-all hover:-translate-y-0.5 hover:bg-primary/95"
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
