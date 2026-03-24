import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BetaAccessManager } from "@/components/admin/beta-access-manager";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  return dateFormatter.format(new Date(value));
}

export default async function AdminBetaPage() {
  const user = await getAdminUser();
  if (!user) return null;

  const entries = await prisma.betaAccessInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalEntries = entries.length;
  const activatedEntries = entries.filter((entry) => entry.activatedAt).length;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Beta Setup</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Private Beta für Admins und 10 Paare
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Hier legst du Beta-Couples direkt an und erzeugst einfache Startlinks. Die manuelle
            E-Mail-Allowlist bleibt nur noch als Reserve für Sonderfälle.
          </p>
        </div>
      </section>

      <BetaAccessManager totalEntries={totalEntries} activatedEntries={activatedEntries} />

      <Card>
        <CardHeader>
          <CardTitle>Erlaubte E-Mails</CardTitle>
          <CardDescription>{entries.length} Einträge in der Beta-Allowlist.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3 pr-4 font-medium">E-Mail</th>
                <th className="pb-3 pr-4 font-medium">Notiz</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Aktiviert</th>
                <th className="pb-3 font-medium">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 font-medium text-foreground">{entry.email}</td>
                  <td className="py-4 pr-4 text-muted-foreground">{entry.note ?? "n/a"}</td>
                  <td className="py-4 pr-4">
                    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                      {entry.activatedAt ? "aktiv" : "wartet"}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-muted-foreground">
                    {formatDate(entry.activatedAt)}
                  </td>
                  <td className="py-4 text-muted-foreground">{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
