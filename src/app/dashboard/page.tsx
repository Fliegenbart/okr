import Link from "next/link";
import { headers } from "next/headers";

import { getAuthSession } from "@/auth";
import { InvitePartnerCard } from "@/components/dashboard/invite-partner-card";
import { ObjectiveProgressMiniChart } from "@/components/dashboard/objective-progress-mini-chart";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { ObjectiveCard } from "@/components/dashboard/objective-card";
import { PowerMoveCard } from "@/components/dashboard/power-move-card";
import { ProgressDonut } from "@/components/dashboard/progress-donut";
import { QuarterProgressChart } from "@/components/dashboard/quarter-progress-chart";
import { QuarterFilter } from "@/components/dashboard/quarter-filter";
import { VisionHeader } from "@/components/dashboard/vision-header";
import { Card, CardContent } from "@/components/ui/card";
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
  const headerList = await headers();
  const forwardedProto = headerList.get("x-forwarded-proto") ?? "http";
  const forwardedHost =
    headerList.get("x-forwarded-host") ?? headerList.get("host");
  const requestOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : "";
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    requestOrigin
  ).replace(/\/$/, "");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getAuthSession();

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-lg font-semibold text-foreground">
              Bitte melde dich an
            </p>
            <p className="text-sm text-muted-foreground">
              Deine Sitzung ist abgelaufen oder ungültig.
            </p>
            <Link
              href="/auth/signin?callbackUrl=/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Zur Anmeldung
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userId = session.user.id;
  const userEmail = session.user.email ?? undefined;

  if (!userId && !userEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-lg font-semibold text-foreground">
              Bitte melde dich an
            </p>
            <p className="text-sm text-muted-foreground">
              Deine Sitzung ist abgelaufen oder ungültig.
            </p>
            <Link
              href="/auth/signin?callbackUrl=/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Zur Anmeldung
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const user = await prisma.user.findFirst({
    where: userId
      ? { id: userId }
      : userEmail
        ? { email: userEmail }
        : undefined,
    include: {
      couple: {
        include: {
          users: {
            select: { id: true },
          },
          invites: {
            where: {
              acceptedAt: null,
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
      },
    },
  });

  if (!user?.couple) {
    const canCreateCouple = session.user.email
      ? await canEmailCreateCouple(session.user.email)
      : false;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <OnboardingCard
          userEmail={session.user.email}
          initialInviteToken={resolvedSearchParams?.invite}
          canCreateCouple={canCreateCouple}
        />
      </div>
    );
  }

  const { couple } = user;
  const activeQuarter =
    couple.quarters.find(
      (quarter) => quarter.startsAt <= now && quarter.endsAt >= now
    ) ?? couple.quarters[0];
  const preferredQuarterId = user.preferredQuarterId ?? null;
  const selectedQuarterId =
    resolvedSearchParams?.quarter ?? preferredQuarterId ?? "all";
  const filteredObjectives =
    selectedQuarterId === "all"
      ? couple.objectives
      : couple.objectives.filter(
          (objective) => objective.quarterId === selectedQuarterId
        );

  const selectedQuarter =
    selectedQuarterId === "all"
      ? activeQuarter ?? null
      : couple.quarters.find((quarter) => quarter.id === selectedQuarterId) ??
        activeQuarter ??
        null;
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
        unit: keyResult.unit,
      })),
      insights: {
        ...insights,
        lastUpdateAt: insights.lastUpdateAt
          ? insights.lastUpdateAt.toISOString()
          : null,
      },
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <VisionHeader vision={couple.vision} coupleName={couple.name} />

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="space-y-4 p-6">
              <InvitePartnerCard
                latestInvite={
                  couple.invites[0]
                    ? {
                        email: couple.invites[0].email,
                        token: couple.invites[0].token,
                        expiresAt: couple.invites[0].expiresAt.toISOString(),
                      }
                    : null
                }
                isCoupleFull={couple.users.length >= 2}
                appUrl={appUrl}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm font-medium text-primary">
                Aktuelles Quartal
              </p>
              {activeQuarter ? (
                <>
                  <p className="text-lg font-semibold text-foreground">
                    {activeQuarter.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dateFormatter.format(activeQuarter.startsAt)} –{" "}
                    {dateFormatter.format(activeQuarter.endsAt)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch kein Quartal angelegt.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <p className="text-sm font-medium text-primary">
                Durchschnittlicher Fortschritt
              </p>
              <p className="text-xs text-muted-foreground">
                Mittelwert über alle Objectives im gewählten Quartal.
              </p>
              <ProgressDonut
                value={averageProgress}
                size={100}
                strokeWidth={8}
                showValue={true}
                showLabel={false}
                progressClassName="text-primary"
                valueClassName="text-xl"
              />
            </CardContent>
          </Card>
        </div>

        <section
          className="mt-10 space-y-4"
          data-testid="quarter-progress-section"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Quartalsverlauf
            </h2>
            <p className="text-sm text-muted-foreground">
              Verlauf der Objectives von der Anlage bis heute, mit Soll-Linie bis
              zum Quartalsende.
            </p>
          </div>

          {quarterProgressSnapshot ? (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.35fr,0.65fr]">
                <Card className="rounded-2xl border-border shadow-sm">
                  <CardContent className="space-y-5 p-6">
                    <div className="space-y-1">
                      <p className="text-sm uppercase tracking-[0.2em] text-primary">
                        Gesamtverlauf Quartal
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="font-semibold text-foreground">
                          {quarterProgressSnapshot.quarterTitle}
                        </span>
                        <span className="text-muted-foreground">
                          {dateFormatter.format(
                            new Date(quarterProgressSnapshot.quarterStartsAt)
                          )}{" "}
                          –{" "}
                          {dateFormatter.format(
                            new Date(quarterProgressSnapshot.quarterEndsAt)
                          )}
                        </span>
                      </div>
                    </div>

                    <QuarterProgressChart
                      data={quarterProgressSnapshot.aggregateSeries}
                      todayKey={quarterProgressSnapshot.todayKey}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border shadow-sm">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-primary">
                      Quartals-Health
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Durchschnitt
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.averageProgress}%
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Objectives
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.totalObjectives}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Ohne Update
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.objectivesWithoutUpdates}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Tage bis Ende
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {quarterProgressSnapshot.daysRemaining}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tag {quarterProgressSnapshot.daysElapsed} im Quartal
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {quarterProgressSnapshot.objectiveSeries.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {quarterProgressSnapshot.objectiveSeries.map((objective) => (
                    <ObjectiveProgressMiniChart
                      key={objective.id}
                      objective={objective}
                      href={`/dashboard/objectives/${objective.id}`}
                    />
                  ))}
                </div>
              ) : (
                <Card className="rounded-2xl border-border shadow-sm">
                  <CardContent className="space-y-3 p-6">
                    <p className="text-lg font-semibold text-foreground">
                      Noch keine Objectives in diesem Quartal
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sobald ihr in {quarterProgressSnapshot.quarterTitle} das erste
                      Objective anlegt, erscheint hier der Verlauf.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="space-y-3 p-6">
                <p className="text-lg font-semibold text-foreground">
                  Noch kein Quartal vorhanden
                </p>
                <p className="text-sm text-muted-foreground">
                  Lege zuerst ein Quartal an, damit wir den Verlauf eurer OKRs
                  anzeigen können.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Aktuelle Objectives
            </h2>
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
                <PowerMoveCard
                  quarterId={selectedQuarter?.id ?? null}
                  quarterTitle={selectedQuarter?.title ?? null}
                  hasObjectives={objectiveCards.length > 0}
                />
              </div>
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
            </div>
          ) : (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-lg font-semibold text-foreground">
                  Noch keine Objectives
                </p>
                <p className="text-sm text-muted-foreground">
                  Sobald ihr euer erstes Objective anlegt, erscheint es hier.
                </p>
                <Link
                  href="/dashboard/objectives/new"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  Objective erstellen
                </Link>
              </CardContent>
            </Card>
          )}
        </section>

      </div>
    </div>
  );
}
