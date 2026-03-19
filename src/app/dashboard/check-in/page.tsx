import Link from "next/link";

import { getAuthSession } from "@/auth";
import { CommitmentForm } from "@/components/dashboard/commitment-form";
import { CheckInComposer } from "@/components/dashboard/check-in-composer";
import { CommitmentStatusActions } from "@/components/dashboard/commitment-status-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { conversationTemplates } from "@/lib/couple-engagement";
import {
  redirectForMissingCouple,
  requireDashboardSubpageAccess,
} from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

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
  const session = await getAuthSession();
  requireDashboardSubpageAccess(session, "/dashboard/check-in");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
    include: {
      couple: {
        include: {
          users: { select: { id: true, name: true, email: true } },
          objectives: {
            where: { archivedAt: null },
            select: { id: true, title: true },
            orderBy: { updatedAt: "desc" },
          },
          quarters: {
            orderBy: { startsAt: "desc" },
          },
        },
      },
    },
  });

  if (!user?.couple) {
    redirectForMissingCouple(session);
  }

  const now = new Date();
  const [recentCheckIns, openCommitments, openReminders] = await Promise.all([
    prisma.checkInSession.findMany({
      where: { coupleId: user.couple.id },
      include: {
        createdBy: { select: { name: true, email: true } },
        quarter: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.commitment.findMany({
      where: { coupleId: user.couple.id, status: "OPEN" },
      include: {
        owner: { select: { name: true, email: true } },
        objective: { select: { title: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.reminder.findMany({
      where: { coupleId: user.couple.id, status: "PENDING", dueAt: { gte: now } },
      include: {
        quarter: { select: { title: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
  ]);

  const activeQuarter =
    user.couple.quarters.find(
      (quarter) => quarter.startsAt <= now && quarter.endsAt >= now
    ) ?? user.couple.quarters[0] ?? null;

  const scheduleEnabled = Boolean(
    user.couple.checkInWeekday &&
      user.couple.checkInTime &&
      user.couple.checkInDurationMinutes
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Check-in & Commitments
          </h1>
          <p className="text-sm text-muted-foreground">
            Hier sammelt ihr euren Wochen-Check-in, konkrete Commitments und die
            nächsten Follow-ups an einem Ort.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="p-6">
              <CheckInComposer
                templates={conversationTemplates}
                selectedTemplateKey={resolvedSearchParams?.template ?? null}
                quarterTitle={activeQuarter?.title ?? null}
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="space-y-3 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-primary">
                  Check-in-Status
                </p>
                <p className="text-sm text-muted-foreground">
                  {scheduleEnabled
                    ? `Euer regelmäßiger Check-in ist eingerichtet (${user.couple.checkInWeekday} / ${user.couple.checkInTime}).`
                    : "Euer Check-in ist noch nicht terminiert."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Aktuelles Quartal: {activeQuarter?.title ?? "kein Quartal"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/templates"
                    className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
                  >
                    Templates ansehen
                  </Link>
                  <Link
                    href="/dashboard/reminders"
                    className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
                  >
                    Reminder öffnen
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle>Neues Commitment</CardTitle>
              </CardHeader>
              <CardContent>
                <CommitmentForm
                  ownerOptions={user.couple.users.map((member) => ({
                    id: member.id,
                    label: member.name ?? member.email ?? "Unbekannt",
                  }))}
                  objectiveOptions={user.couple.objectives.map((objective) => ({
                    id: objective.id,
                    label: objective.title,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>Offene Commitments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {openCommitments.length ? (
                openCommitments.map((commitment) => (
                  <div
                    key={commitment.id}
                    className="space-y-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {commitment.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {commitment.objective?.title
                          ? `Objective: ${commitment.objective.title}`
                          : "Keinem Objective zugeordnet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {commitment.owner
                          ? `Owner: ${commitment.owner.name ?? commitment.owner.email ?? "Unbekannt"}`
                          : "Kein Owner"}
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
                <p className="text-sm text-muted-foreground">
                  Noch keine offenen Commitments.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>Letzte Check-ins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentCheckIns.length ? (
                recentCheckIns.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="space-y-2 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {checkIn.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dateTimeFormatter.format(checkIn.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Mood {formatMood(checkIn.moodRating)}
                      </span>
                    </div>
                    {checkIn.summary ? (
                      <p className="text-sm text-muted-foreground">
                        {checkIn.summary}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {checkIn.quarter?.title
                        ? `Quartal: ${checkIn.quarter.title}`
                        : "Ohne Quartalszuordnung"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch kein Check-in gespeichert.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>Bevorstehende Reminder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {openReminders.length ? (
                openReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {reminder.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fällig {dateTimeFormatter.format(reminder.dueAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reminder.quarter?.title
                        ? `Quartal: ${reminder.quarter.title}`
                        : "In-App Reminder"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Keine anstehenden Reminder.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>Template-Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversationTemplates.map((template) => (
                <Link
                  key={template.key}
                  href={`/dashboard/templates?focus=${template.key}`}
                  className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/30"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {template.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.description}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
