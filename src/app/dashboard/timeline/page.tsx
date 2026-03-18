import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { CommitmentForm } from "@/components/dashboard/commitment-form";
import { TimelineNoteForm } from "@/components/dashboard/timeline-note-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function kindLabel(kind: string) {
  switch (kind) {
    case "CHECK_IN":
      return "Check-in";
    case "OBJECTIVE_UPDATE":
      return "Objective";
    case "COMMITMENT_CREATED":
      return "Commitment";
    case "COMMITMENT_DONE":
      return "Erledigt";
    case "NOTE":
      return "Notiz";
    case "MILESTONE":
      return "Meilenstein";
    case "REMINDER":
      return "Reminder";
    default:
      return kind;
  }
}

export default async function TimelinePage() {
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
          users: { select: { id: true, name: true, email: true } },
          objectives: {
            where: { archivedAt: null },
            select: { id: true, title: true },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  });

  if (!user?.couple) {
    return notFound();
  }

  const events = await prisma.timelineEvent.findMany({
    where: { coupleId: user.couple.id },
    include: {
      commitment: { select: { title: true } },
      objective: { select: { title: true } },
      checkInSession: { select: { title: true } },
      reminder: { select: { title: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

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
          <h1 className="text-3xl font-semibold text-foreground">Timeline</h1>
          <p className="text-sm text-muted-foreground">
            Hier seht ihr die wichtigsten Ereignisse eurer Beziehung im Verlauf.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>Neue Notiz</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineNoteForm />
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

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardHeader>
            <CardTitle>Verlauf</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.length ? (
              events.map((event) => (
                <div
                  key={event.id}
                  className="space-y-2 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {event.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dateTimeFormatter.format(event.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                      {kindLabel(event.kind)}
                    </span>
                  </div>
                  {event.summary ? (
                    <p className="text-sm text-muted-foreground">
                      {event.summary}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {event.commitment?.title ? (
                      <span>Commitment: {event.commitment.title}</span>
                    ) : null}
                    {event.objective?.title ? (
                      <span>Objective: {event.objective.title}</span>
                    ) : null}
                    {event.checkInSession?.title ? (
                      <span>Check-in: {event.checkInSession.title}</span>
                    ) : null}
                    {event.reminder?.title ? (
                      <span>Reminder: {event.reminder.title}</span>
                    ) : null}
                    {event.createdBy?.name || event.createdBy?.email ? (
                      <span>
                        Von {event.createdBy.name ?? event.createdBy.email}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Timeline-Einträge vorhanden.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

