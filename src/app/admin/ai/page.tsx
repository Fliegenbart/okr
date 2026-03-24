import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function AdminAiPage() {
  const user = await getAdminUser();
  if (!user) return null;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [transcripts, rateLimitEvents24h, rateLimitEvents, recentTranscripts] = await Promise.all([
    prisma.transcript.count(),
    prisma.rateLimitEvent.count({ where: { createdAt: { gte: last24h } } }),
    prisma.rateLimitEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.transcript.findMany({
      include: {
        couple: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      orderBy: { importedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">KI-Bereich</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">OKR-Coach im Blick</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Hier seht ihr, wie viele Inhalte importiert wurden und ob es zuletzt Sperren gab.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Transcripts gesamt</CardDescription>
            <CardTitle className="text-3xl">{transcripts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Rate-Limits 24h</CardDescription>
            <CardTitle className="text-3xl">{rateLimitEvents24h}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Letzte Abuse Events</CardDescription>
            <CardTitle className="text-3xl">{rateLimitEvents.length}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Zuletzt importierte Inhalte</CardTitle>
            <CardDescription>Die letzten Einträge in der Wissensbasis.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-6">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Titel</th>
                  <th className="pb-3 pr-4 font-medium">Paar</th>
                  <th className="pb-3 pr-4 font-medium">Abschnitte</th>
                  <th className="pb-3 font-medium">Import</th>
                </tr>
              </thead>
              <tbody>
                {recentTranscripts.map((transcript) => (
                  <tr key={transcript.id} className="border-b border-border/60 last:border-0">
                    <td className="py-4 pr-4">
                      <div className="font-medium text-foreground">{transcript.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {transcript.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      {transcript.couple?.name ?? statusPill("global", "neutral")}
                    </td>
                    <td className="py-4 pr-4">{transcript._count.chunks}</td>
                    <td className="py-4 text-muted-foreground">
                      {formatDate(transcript.importedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zuletzt geblockte Anfragen</CardTitle>
            <CardDescription>Die letzten geblockten oder protokollierten Versuche.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rateLimitEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{event.action}</div>
                    <div className="text-xs text-muted-foreground">{event.key}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
