import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { getAuthSession } from "@/auth";
import { CoupleSettingsForm } from "@/components/dashboard/couple-settings-form";
import { CheckInScheduleCard } from "@/components/dashboard/check-in-schedule-card";
import { InvitePartnerCard } from "@/components/dashboard/invite-partner-card";
import { ObjectiveRestoreButton } from "@/components/dashboard/objective-restore-button";
import { QuarterForm } from "@/components/dashboard/quarter-form";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

export default async function SettingsPage() {
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

  const session = await getAuthSession();

  if (!session?.user?.email && !session?.user?.id) {
    return notFound();
  }

  const now = new Date();
  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
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
          quarters: {
            orderBy: { startsAt: "desc" },
          },
          objectives: {
            where: { archivedAt: { not: null } },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  });

  if (!user?.couple) {
    return notFound();
  }

  const { couple } = user;

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
            Einstellungen
          </h1>
          <p className="text-sm text-muted-foreground">
            Verwalte euer Couple, Quartale und Einladungen.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Couple Details
              </p>
              <CoupleSettingsForm name={couple.name} vision={couple.vision} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
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
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Neues Quartal
              </p>
              <QuarterForm
                existingTitles={couple.quarters.map((quarter) => quarter.title)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Vorhandene Quartale
              </p>
              {couple.quarters.length ? (
                <div className="space-y-3">
                  {couple.quarters.map((quarter) => (
                    <div
                      key={quarter.id}
                      className="rounded-2xl border border-border bg-card p-4"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {quarter.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dateFormatter.format(quarter.startsAt)} – {" "}
                        {dateFormatter.format(quarter.endsAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch keine Quartale vorhanden.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">
              Vision & Mission
            </p>
            <p className="text-sm text-muted-foreground">
              Ein kurzer, emotionaler Anker fuer euer Quartal.
            </p>
            <Link
              href="/dashboard/vision-mission"
              className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Vision & Mission bearbeiten
            </Link>
          </CardContent>
        </Card>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">
              Archivierte Objectives
            </p>
            {couple.objectives.length ? (
              <div className="space-y-3">
                {couple.objectives.map((objective) => (
                  <div
                    key={objective.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {objective.title}
                      </p>
                      {objective.description ? (
                        <p className="text-xs text-muted-foreground">
                          {objective.description}
                        </p>
                      ) : null}
                    </div>
                    <ObjectiveRestoreButton objectiveId={objective.id} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine archivierten Objectives.
              </p>
            )}
          </CardContent>
        </Card>

        <Card id="checkin" className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-4 p-6">
            <CheckInScheduleCard
              coupleName={couple.name}
              enabled={Boolean(couple.checkInWeekday && couple.checkInTime)}
              weekday={couple.checkInWeekday ?? null}
              time={couple.checkInTime ?? null}
              durationMinutes={couple.checkInDurationMinutes ?? null}
              timeZone={couple.checkInTimeZone ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
