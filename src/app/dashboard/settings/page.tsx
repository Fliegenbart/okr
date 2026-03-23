import Link from "next/link";
import { headers } from "next/headers";

import { LogoutButton } from "@/components/auth/logout-button";
import { CoupleSettingsForm } from "@/components/dashboard/couple-settings-form";
import { CheckInScheduleCard } from "@/components/dashboard/check-in-schedule-card";
import { InvitePartnerCard } from "@/components/dashboard/invite-partner-card";
import { ObjectiveRestoreButton } from "@/components/dashboard/objective-restore-button";
import { QuarterForm } from "@/components/dashboard/quarter-form";
import { UserManagementCard } from "@/components/dashboard/user-management-card";
import { Card, CardContent } from "@/components/ui/card";
import { redirectForMissingCouple, requireDashboardSubpageAccess } from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

export default async function SettingsPage() {
  const headerList = await headers();
  const forwardedProto = headerList.get("x-forwarded-proto") ?? "http";
  const forwardedHost = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    requestOrigin
  ).replace(/\/$/, "");

  const viewer = await requireDashboardSubpageAccess("/dashboard/settings");

  const now = new Date();
  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      invites: {
        where: {
          acceptedAt: null,
          revokedAt: null,
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
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
  }

  const currentUserId = viewer.id;
  const latestInvite = couple.invites[0];
  const pendingInvite = latestInvite
    ? {
        email: latestInvite.email,
        expiresAt: latestInvite.expiresAt.toISOString(),
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Einstellungen</h1>
          <p className="text-sm text-muted-foreground">
            Hier verwaltet ihr euren gemeinsamen Bereich, Einladungen und Quartale.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <UserManagementCard
            currentUserId={currentUserId}
            members={couple.users}
            pendingInvite={pendingInvite}
          />

          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <InvitePartnerCard
                latestInvite={
                  latestInvite
                    ? {
                        email: latestInvite.email,
                        token: latestInvite.token,
                        expiresAt: latestInvite.expiresAt.toISOString(),
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
                Euer gemeinsamer Bereich
              </p>
              <CoupleSettingsForm name={couple.name} vision={couple.vision} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.2em] text-primary">Konto & Sitzung</p>
                <p className="text-sm text-muted-foreground">
                  Angemeldet als {viewer.email ?? "unbekannter Nutzer"}.
                </p>
              </div>
              <LogoutButton className="w-full sm:w-auto" />
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">Neues Quartal</p>
              <QuarterForm existingTitles={couple.quarters.map((quarter) => quarter.title)} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">Eure Quartale</p>
              {couple.quarters.length ? (
                <div className="space-y-3">
                  {couple.quarters.map((quarter) => (
                    <div key={quarter.id} className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-sm font-semibold text-foreground">{quarter.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {dateFormatter.format(quarter.startsAt)} –{" "}
                        {dateFormatter.format(quarter.endsAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Quartale vorhanden.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Vision & Mission</p>
            <p className="text-sm text-muted-foreground">
              Haltet fest, was euch wichtig ist und woran ihr euch orientieren wollt.
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
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Archivierte Ziele</p>
            {couple.objectives.length ? (
              <div className="space-y-3">
                {couple.objectives.map((objective) => (
                  <div
                    key={objective.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{objective.title}</p>
                      {objective.description ? (
                        <p className="text-xs text-muted-foreground">{objective.description}</p>
                      ) : null}
                    </div>
                    <ObjectiveRestoreButton objectiveId={objective.id} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine archivierten Ziele.</p>
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
