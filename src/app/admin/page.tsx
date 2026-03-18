import Link from "next/link";

import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/admin";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  return dateFormatter.format(new Date(value));
}

function statusPill(label: string, tone: "neutral" | "good" | "warn" | "bad" = "neutral") {
  const tones = {
    neutral: "bg-muted text-foreground",
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-rose-100 text-rose-800",
  } as const;

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}

export default async function AdminOverviewPage() {
  const user = await getAdminUser();
  if (!user) return null;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    adminUsers,
    couples,
    boards,
    objectives,
    transcripts,
    pendingInvites,
    revokedInvites,
    rateLimitEvents24h,
    auditEvents24h,
    recentInvites,
    recentCouples,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.couple.count(),
    prisma.board.count(),
    prisma.objective.count({ where: { archivedAt: null } }),
    prisma.transcript.count(),
    prisma.invite.count({
      where: {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    }),
    prisma.invite.count({ where: { revokedAt: { not: null } } }),
    prisma.rateLimitEvent.count({ where: { createdAt: { gte: last24h } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.invite.findMany({
      include: {
        couple: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.couple.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            updatedAt: true,
          },
        },
        boards: {
          select: { updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
        invites: {
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        objectives: {
          where: { archivedAt: null },
          select: { id: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      include: {
        actor: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const metrics = [
    { label: "Nutzer", value: totalUsers },
    { label: "Admins", value: adminUsers },
    { label: "Couples", value: couples },
    { label: "Boards", value: boards },
    { label: "Objectives", value: objectives },
    { label: "Transcripts", value: transcripts },
    { label: "Aktive Invites", value: pendingInvites },
    { label: "Rate-Limits 24h", value: rateLimitEvents24h },
  ];

  const quickLinks = [
    {
      href: "/admin/beta",
      label: "Beta",
      description: "Allowlist für private Paare und Support-Login.",
    },
    {
      href: "/admin/invites",
      label: "Invites",
      description: "Offene, angenommene und widerrufene Einladungen.",
    },
    {
      href: "/admin/couples",
      label: "Couples",
      description: "Mitglieder, Aktivität und offene Probleme.",
    },
    {
      href: "/admin/boards",
      label: "Boards",
      description: "Master- und Quarter-Boards mit Versionen.",
    },
    {
      href: "/admin/ai",
      label: "AI Ops",
      description: "Rate Limits, Transcripts und Wissensbasis.",
    },
    {
      href: "/admin/audit",
      label: "Audit",
      description: "Nachvollziehbarkeit aller kritischen Aktionen.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                Admin Start
              </p>
              <h1 className="text-3xl font-semibold text-foreground">
                Guten Morgen, {user.name ?? user.email ?? "Admin"}
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Hier findest du die wichtigsten Wege zu Support, Kontrolle und Systemstatus. Der
                Bereich ist bewusst schlank gehalten, damit du schnell zu Invites, Couples, Boards
                und Audit-Logs kommst.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/invites">Invites prüfen</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/couples">Couples ansehen</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/audit">Audit öffnen</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schnellzugriff</CardTitle>
            <CardDescription>Die wichtigsten Admin-Bereiche auf einen Blick.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-border bg-muted/30 p-4 transition hover:border-primary/40 hover:bg-white"
              >
                <div className="text-sm font-semibold text-foreground">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.description}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {statusPill(`${auditEvents24h} Audit-Events`, "neutral")}
          {statusPill(`${revokedInvites} Revoked`, revokedInvites > 0 ? "warn" : "neutral")}
        </div>
        <p className="text-sm text-muted-foreground">Letzte Systemsicht: {formatDate(now)}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Letzte Couples</CardTitle>
            <CardDescription>
              Aktuelle Teams mit Mitgliedern, Boards und offenen Einladungen.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-6">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Couple</th>
                  <th className="pb-3 pr-4 font-medium">Mitglieder</th>
                  <th className="pb-3 pr-4 font-medium">Boards</th>
                  <th className="pb-3 pr-4 font-medium">Offene Invites</th>
                  <th className="pb-3 font-medium">Aktivität</th>
                </tr>
              </thead>
              <tbody>
                {recentCouples.map((couple) => {
                  const memberCount = couple.users.length;
                  const boardUpdatedAt = couple.boards[0]?.updatedAt ?? null;
                  const objectiveUpdatedAt = couple.objectives[0]?.updatedAt ?? null;
                  const activityAt =
                    boardUpdatedAt && objectiveUpdatedAt
                      ? boardUpdatedAt > objectiveUpdatedAt
                        ? boardUpdatedAt
                        : objectiveUpdatedAt
                      : (boardUpdatedAt ?? objectiveUpdatedAt ?? couple.updatedAt);

                  return (
                    <tr key={couple.id} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{couple.name}</div>
                        <div className="text-xs text-muted-foreground">{couple.id.slice(0, 8)}</div>
                      </td>
                      <td className="py-4 pr-4">{memberCount}</td>
                      <td className="py-4 pr-4">{couple.boards.length}</td>
                      <td className="py-4 pr-4">{couple.invites.length}</td>
                      <td className="py-4 text-muted-foreground">{formatDate(activityAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Letzte Audit Events</CardTitle>
            <CardDescription>Kritische Admin-Aktionen und Systemereignisse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAuditLogs.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{entry.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.targetType}
                      {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {entry.actor?.email ?? entry.actor?.name ?? "System"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Letzte Invites</CardTitle>
            <CardDescription>Status und Zuständigkeit der jüngsten Einladungen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentInvites.map((invite) => {
              const isRevoked = Boolean(invite.revokedAt);
              const isAccepted = Boolean(invite.acceptedAt);
              const isExpired = invite.expiresAt < now;

              const tone = isRevoked ? "bad" : isAccepted ? "good" : isExpired ? "warn" : "neutral";

              const label = isRevoked
                ? "revoked"
                : isAccepted
                  ? "accepted"
                  : isExpired
                    ? "expired"
                    : "pending";

              return (
                <div
                  key={invite.id}
                  className="rounded-xl border border-border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-foreground">{invite.email}</div>
                      <div className="text-xs text-muted-foreground">{invite.couple.name}</div>
                    </div>
                    {statusPill(label, tone)}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Erstellt {formatDate(invite.createdAt)} · Läuft aus{" "}
                    {formatDate(invite.expiresAt)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Systemsignale</CardTitle>
            <CardDescription>Ein schneller Blick auf den Zustand des Betriebs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Open Admins
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{adminUsers}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Aktive Rollen mit Adminzugriff
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Revoked Invites
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{revokedInvites}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Bereits gesperrte Einladungen
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Audit 24h</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{auditEvents24h}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Neue Admin- oder Systemereignisse
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Rate Limits 24h
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {rateLimitEvents24h}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Abgewehrte Abuse-Versuche</div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
