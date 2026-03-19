import { startAdminCouplePreview, stopAdminCouplePreview } from "@/actions/admin";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/admin";
import { getAuthenticatedViewer } from "@/lib/active-couple";

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

export default async function AdminCouplesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const user = await getAdminUser();
  if (!user) return null;
  const viewer = await getAuthenticatedViewer();
  const previewCoupleId = viewer?.previewCoupleId ?? null;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const q = resolvedSearchParams?.q?.trim() ?? "";
  const now = new Date();

  const couples = await prisma.couple.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            {
              users: {
                some: {
                  OR: [
                    { email: { contains: q, mode: "insensitive" } },
                    { name: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      inviteCode: true,
      updatedAt: true,
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
      invites: {
        where: {
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: {
          id: true,
          email: true,
          expiresAt: true,
        },
      },
      _count: {
        select: {
          boards: true,
          objectives: true,
          quarters: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
          Couple Management
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">
              Couples im Blick
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Übersicht über Mitglieder, Boards, Objectives und offene
              Einladungen.
            </p>
          </div>

          <form className="flex w-full gap-2 md:w-auto" action="/admin/couples" method="get">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Couple oder E-Mail"
              className="md:w-72"
            />
            <Button type="submit" variant="outline">
              Suchen
            </Button>
          </form>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Alle Couples</CardTitle>
          <CardDescription>{couples.length} Couples gefunden.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3 pr-4 font-medium">Couple</th>
                <th className="pb-3 pr-4 font-medium">Mitglieder</th>
                <th className="pb-3 pr-4 font-medium">Boards</th>
                <th className="pb-3 pr-4 font-medium">Objectives</th>
                <th className="pb-3 pr-4 font-medium">Offene Invites</th>
                <th className="pb-3 pr-4 font-medium">Invite Code</th>
                <th className="pb-3 font-medium">Aktivität</th>
                <th className="pb-3 text-right font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {couples.map((couple) => {
                const memberCount = couple.users.length;
                const isComplete = memberCount >= 2;
                const tone = isComplete ? "good" : memberCount === 1 ? "warn" : "bad";
                const label = isComplete ? "complete" : memberCount === 1 ? "partial" : "empty";

                return (
                  <tr key={couple.id} className="border-b border-border/60 last:border-0">
                    <td className="py-4 pr-4">
                      <div className="font-medium text-foreground">{couple.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {statusPill(label, tone)}
                        {statusPill(couple.id.slice(0, 8))}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {couple.users
                          .map((member) => member.email ?? member.name ?? member.id.slice(0, 8))
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="py-4 pr-4">{memberCount}</td>
                    <td className="py-4 pr-4">{couple._count.boards}</td>
                    <td className="py-4 pr-4">{couple._count.objectives}</td>
                    <td className="py-4 pr-4">{couple.invites.length}</td>
                    <td className="py-4 pr-4 font-mono text-xs text-muted-foreground">
                      {couple.inviteCode}
                    </td>
                    <td className="py-4 pr-4 text-muted-foreground">
                      {formatDate(couple.updatedAt)}
                    </td>
                    <td className="py-4 text-right">
                      {previewCoupleId === couple.id ? (
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href="/dashboard">Dashboard öffnen</a>
                          </Button>
                          <form action={stopAdminCouplePreview}>
                            <input
                              type="hidden"
                              name="redirectTo"
                              value="/admin/couples"
                            />
                            <Button size="sm" variant="secondary" type="submit">
                              Preview beenden
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <form action={startAdminCouplePreview.bind(null, couple.id)}>
                          <input type="hidden" name="redirectTo" value="/dashboard" />
                          <Button size="sm" type="submit">
                            Als Paar ansehen
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
