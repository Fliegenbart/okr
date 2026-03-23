import Link from "next/link";

import { ReminderStatusActions } from "@/components/dashboard/reminder-status-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectForMissingCouple, requireDashboardSubpageAccess } from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Offen";
    case "DONE":
      return "Erledigt";
    case "DISMISSED":
      return "Ausgeblendet";
    default:
      return status;
  }
}

export default async function RemindersPage() {
  const viewer = await requireDashboardSubpageAccess("/dashboard/reminders");

  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    select: { id: true },
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
  }

  const [upcoming, recent] = await Promise.all([
    prisma.reminder.findMany({
      where: { coupleId: couple.id, status: "PENDING" },
      include: {
        quarter: { select: { title: true } },
        commitment: { select: { title: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 12,
    }),
    prisma.reminder.findMany({
      where: { coupleId: couple.id, status: { in: ["DONE", "DISMISSED"] } },
      include: {
        quarter: { select: { title: true } },
        commitment: { select: { title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

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
          <h1 className="text-3xl font-semibold text-foreground">Erinnerungen</h1>
          <p className="text-sm text-muted-foreground">
            Hier seht ihr, was bald ansteht und was ihr schon erledigt habt.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>Anstehend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcoming.length ? (
                upcoming.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="space-y-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{reminder.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Fällig {dateTimeFormatter.format(reminder.dueAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reminder.quarter?.title
                          ? `Quartal: ${reminder.quarter.title}`
                          : reminder.commitment?.title
                            ? `Zusage: ${reminder.commitment.title}`
                            : "System-Erinnerung"}
                      </p>
                    </div>
                    <ReminderStatusActions reminderId={reminder.id} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Keine offenen Erinnerungen.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>Erledigt / Ausgeblendet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recent.length ? (
                recent.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="space-y-2 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{reminder.title}</p>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        {statusLabel(reminder.status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dateTimeFormatter.format(reminder.updatedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reminder.quarter?.title
                        ? `Quartal: ${reminder.quarter.title}`
                        : reminder.commitment?.title
                          ? `Zusage: ${reminder.commitment.title}`
                          : "System-Erinnerung"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine erledigten Erinnerungen.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
