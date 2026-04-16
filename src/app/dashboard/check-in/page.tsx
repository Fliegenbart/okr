import Link from "next/link";

import { CommitmentForm } from "@/components/dashboard/commitment-form";
import { CheckInComposer } from "@/components/dashboard/check-in-composer";
import { CommitmentStatusActions } from "@/components/dashboard/commitment-status-actions";
import { KeyResultQuickUpdateDialog } from "@/components/dashboard/key-result-quick-update-dialog";
import {
  KeyResultSortSelect,
  ObjectiveSortSelect,
} from "@/components/dashboard/sort-preference-select";
import { TrafficLightChip } from "@/components/dashboard/traffic-light-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { conversationTemplates } from "@/lib/couple-engagement";
import { redirectForMissingCouple, requireDashboardSubpageAccess } from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";
import { calculateKeyResultProgress } from "@/lib/key-results";
import { formatProgressPercent } from "@/lib/progress";
import { sortKeyResults, sortObjectives } from "@/lib/sorting";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

function formatMood(value?: number | null) {
  if (!value) return "n/a";
  return `${value}/5`;
}

export default async function CheckInPage({
  searchParams,
}: {
  searchParams?: Promise<{ template?: string }>;
}) {
  const viewer = await requireDashboardSubpageAccess("/dashboard/check-in");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    include: {
      users: { select: { id: true, name: true, email: true } },
      objectives: {
        where: { archivedAt: null },
        include: {
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
        orderBy: { createdAt: "asc" },
      },
      quarters: {
        orderBy: { startsAt: "desc" },
      },
    },
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
  }

  const now = new Date();
  const [recentCheckIns, openCommitments] = await Promise.all([
    prisma.checkInSession.findMany({
      where: { coupleId: couple.id },
      include: {
        createdBy: { select: { name: true, email: true } },
        quarter: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.commitment.findMany({
      where: { coupleId: couple.id, status: "OPEN" },
      include: {
        owner: { select: { name: true, email: true } },
        objective: { select: { title: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
  ]);

  const activeQuarter =
    couple.quarters.find((quarter) => quarter.startsAt <= now && quarter.endsAt >= now) ??
    couple.quarters[0] ??
    null;

  const scheduleEnabled = Boolean(
    couple.checkInWeekday && couple.checkInTime && couple.checkInDurationMinutes
  );
  const sortedObjectives = sortObjectives(couple.objectives, viewer.preferredObjectiveSort);

  return (
    <div className="min-h-screen bg-background">
      <div className="dashboard-shell mx-auto w-full max-w-[1400px] px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6 space-y-3">
          <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Weekly Reset</p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.05em] text-foreground">
            Wochen-Check
          </h1>
          <p className="text-sm text-muted-foreground">
            Hier haltet ihr fest, wie eure Woche war, was offen ist und was ihr als Nächstes tun wollt.
          </p>
        </div>

        <section className="mt-8 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Scoring First</p>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                Scoring diese Woche
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Scoret zuerst eure Objectives und Key Results. Die Reflexion bleibt direkt darunter.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <ObjectiveSortSelect value={viewer.preferredObjectiveSort} />
              <KeyResultSortSelect value={viewer.preferredKeyResultSort} />
            </div>
          </div>

          {sortedObjectives.length ? (
            <div className="space-y-4">
              {sortedObjectives.map((objective) => {
                const sortedKeyResults = sortKeyResults(
                  objective.keyResults,
                  viewer.preferredKeyResultSort
                );
                const objectiveProgress = sortedKeyResults.length
                  ? Math.round(
                      sortedKeyResults.reduce(
                        (sum, keyResult) => sum + calculateKeyResultProgress(keyResult),
                        0
                      ) / sortedKeyResults.length
                    )
                  : 0;

                return (
                  <Card key={objective.id} className="rounded-[2rem] border-white/70">
                    <CardContent className="space-y-5 p-6">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <p className="text-xl font-semibold text-foreground">{objective.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Objective-Stand: {formatProgressPercent(objectiveProgress)}%
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/objectives/${objective.id}`}
                          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
                        >
                          Objective öffnen
                        </Link>
                      </div>

                      <div className="space-y-3">
                        {sortedKeyResults.map((keyResult) => {
                          const progress = calculateKeyResultProgress(keyResult);

                          return (
                            <div
                              key={keyResult.id}
                              className="flex flex-col gap-3 rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    {keyResult.title}
                                  </p>
                                  <TrafficLightChip keyResult={keyResult} />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {keyResult.currentValue} / {keyResult.targetValue}
                                  {keyResult.unit ? ` ${keyResult.unit}` : ""} ·{" "}
                                  {formatProgressPercent(progress)}%
                                </p>
                              </div>
                              <KeyResultQuickUpdateDialog
                                keyResultId={keyResult.id}
                                title={keyResult.title}
                                currentValue={keyResult.currentValue}
                                type={keyResult.type}
                                unit={keyResult.unit}
                                buttonSize="sm"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="rounded-[2rem] border-white/70">
              <CardContent className="space-y-3 p-6">
                <p className="text-lg font-semibold text-foreground">Noch keine Objectives</p>
                <p className="text-sm text-muted-foreground">
                  Legt zuerst ein Objective an, damit ihr euren Wochen-Check direkt mit dem Scoring starten könnt.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-[2rem] border-white/70">
            <CardContent className="p-6">
              <CheckInComposer
                templates={conversationTemplates}
                selectedTemplateKey={resolvedSearchParams?.template ?? null}
                quarterTitle={activeQuarter?.title ?? null}
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="metric-glass rounded-[2rem] border-white/70">
              <CardContent className="space-y-3 p-6">
                <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Wochen-Check-Status</p>
                <p className="text-sm text-muted-foreground">
                  {scheduleEnabled
                    ? `Euer regelmäßiger Wochen-Check steht fest (${couple.checkInWeekday} / ${couple.checkInTime}).`
                    : "Euer regelmäßiger Wochen-Check ist noch nicht festgelegt."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Aktuelles Quartal: {activeQuarter?.title ?? "kein Quartal"}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-white/70">
              <CardHeader>
                <CardTitle className="font-display text-2xl font-bold tracking-[-0.04em]">
                  Nächster Schritt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CommitmentForm
                  ownerOptions={couple.users.map((member) => ({
                    id: member.id,
                    label: member.name ?? member.email ?? "Unbekannt",
                  }))}
                  objectiveOptions={couple.objectives.map((objective) => ({
                    id: objective.id,
                    label: objective.title,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <Card className="rounded-[2rem] border-white/70">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-bold tracking-[-0.04em]">
                Offene Zusagen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {openCommitments.length ? (
                openCommitments.map((commitment) => (
                  <div
                    key={commitment.id}
                    className="space-y-3 rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{commitment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {commitment.objective?.title
                          ? `Objective: ${commitment.objective.title}`
                          : "Keinem Objective zugeordnet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {commitment.owner
                          ? `Verantwortlich: ${commitment.owner.name ?? commitment.owner.email ?? "Unbekannt"}`
                          : "Noch niemand verantwortlich"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {commitment.dueAt
                          ? `Fällig ${dateFormatter.format(commitment.dueAt)}`
                          : "Ohne Fälligkeitsdatum"}
                      </p>
                    </div>
                    <CommitmentStatusActions commitmentId={commitment.id} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine offenen Zusagen.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-white/70">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-bold tracking-[-0.04em]">
                Letzte Wochen-Checks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentCheckIns.length ? (
                recentCheckIns.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="space-y-2 rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{checkIn.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateTimeFormatter.format(checkIn.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Stimmung {formatMood(checkIn.moodRating)}
                      </span>
                    </div>
                    {checkIn.summary ? (
                      <p className="text-sm text-muted-foreground">{checkIn.summary}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {checkIn.quarter?.title
                        ? `Quartal: ${checkIn.quarter.title}`
                        : "Ohne Quartalszuordnung"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Noch kein Wochen-Check gespeichert.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
