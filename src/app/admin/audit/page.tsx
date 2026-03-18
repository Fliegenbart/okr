import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function formatMetadata(value: unknown) {
  if (!value) return "—";

  try {
    const raw = JSON.stringify(value);
    return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
  } catch {
    return "—";
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const user = await getAdminUser();
  if (!user) return null;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const q = resolvedSearchParams?.q?.trim() ?? "";

  const logs = await prisma.auditLog.findMany({
    where: q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { targetType: { contains: q, mode: "insensitive" } },
            { targetId: { contains: q, mode: "insensitive" } },
            {
              actor: {
                OR: [
                  { email: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : undefined,
    include: {
      actor: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
          Audit Trail
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">
              Audit-Log und Admin-Aktionen
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Jede kritische Änderung bleibt nachvollziehbar. Hier findest du
              die letzten Admin- und Systemereignisse.
            </p>
          </div>

          <form className="flex w-full gap-2 md:w-auto" action="/admin/audit" method="get">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Action, Target oder Actor"
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
          <CardTitle>Einträge</CardTitle>
          <CardDescription>{logs.length} Einträge gefunden.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3 pr-4 font-medium">Zeit</th>
                <th className="pb-3 pr-4 font-medium">Aktion</th>
                <th className="pb-3 pr-4 font-medium">Target</th>
                <th className="pb-3 pr-4 font-medium">Actor</th>
                <th className="pb-3 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => (
                <tr key={entry.id} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="py-4 pr-4 font-medium text-foreground">
                    {entry.action}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="font-medium text-foreground">{entry.targetType}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.targetId ?? "—"}
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-muted-foreground">
                    {entry.actor?.email ?? entry.actor?.name ?? "System"}
                  </td>
                  <td className="py-4 text-xs text-muted-foreground">
                    {formatMetadata(entry.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

