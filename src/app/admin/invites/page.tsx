import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { revokeInvite } from "@/actions/admin";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
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

export default async function AdminInvitesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const user = await getAdminUser();
  if (!user) return null;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const q = resolvedSearchParams?.q?.trim() ?? "";
  const now = new Date();

  const invites = await prisma.invite.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { couple: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      couple: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
          Einladungen
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">Einladungen verwalten</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Hier seht ihr alle offenen, angenommenen und gesperrten Einladungen an einem Ort.
            </p>
          </div>

          <form className="flex w-full gap-2 md:w-auto" action="/admin/invites" method="get">
            <Input name="q" defaultValue={q} placeholder="E-Mail oder Paar" className="md:w-72" />
            <Button type="submit" variant="outline">
              Suchen
            </Button>
          </form>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Einladungen</CardTitle>
          <CardDescription>{invites.length} Einladungen gefunden.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3 pr-4 font-medium">E-Mail</th>
                <th className="pb-3 pr-4 font-medium">Paar</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Erstellt</th>
                <th className="pb-3 pr-4 font-medium">Läuft aus</th>
                <th className="pb-3 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const isRevoked = Boolean(invite.revokedAt);
                const isAccepted = Boolean(invite.acceptedAt);
                const isExpired = invite.expiresAt < now;

                const tone = isRevoked
                  ? "bad"
                  : isAccepted
                    ? "good"
                    : isExpired
                      ? "warn"
                      : "neutral";

                const label = isRevoked
                  ? "gesperrt"
                  : isAccepted
                    ? "angenommen"
                    : isExpired
                      ? "abgelaufen"
                      : "offen";

                return (
                  <tr key={invite.id} className="border-b border-border/60 last:border-0">
                    <td className="py-4 pr-4">
                      <div className="font-medium text-foreground">{invite.email}</div>
                      <div className="text-xs text-muted-foreground">{invite.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-4 pr-4">{invite.couple.name}</td>
                    <td className="py-4 pr-4">{statusPill(label, tone)}</td>
                    <td className="py-4 pr-4 text-muted-foreground">
                      {formatDate(invite.createdAt)}
                    </td>
                    <td className="py-4 pr-4 text-muted-foreground">
                      {formatDate(invite.expiresAt)}
                    </td>
                    <td className="py-4">
                      {isRevoked || isAccepted ? (
                        <span className="text-xs text-muted-foreground">Keine Aktion</span>
                      ) : (
                        <ConfirmActionDialog
                          triggerLabel="Sperren"
                          title="Einladung sperren"
                          description={`Die Einladung an ${invite.email} für ${invite.couple.name} wird sofort gesperrt.`}
                          confirmLabel="Einladung sperren"
                          action={revokeInvite.bind(null, invite.id)}
                        />
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
