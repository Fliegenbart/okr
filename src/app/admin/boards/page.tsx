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

export default async function AdminBoardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const user = await getAdminUser();
  if (!user) return null;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const q = resolvedSearchParams?.q?.trim() ?? "";

  const boards = await prisma.board.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { boardKey: { contains: q, mode: "insensitive" } },
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
      quarter: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
        },
      },
      _count: {
        select: {
          elements: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Boards</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">Boards im Blick</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Hier seht ihr die Boards der Paare, wie viel darin liegt und wann zuletzt etwas
              geändert wurde.
            </p>
          </div>

          <form className="flex w-full gap-2 md:w-auto" action="/admin/boards" method="get">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Board, Key oder Paar"
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
          <CardTitle>Alle Boards</CardTitle>
          <CardDescription>{boards.length} Boards gefunden.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3 pr-4 font-medium">Board</th>
                <th className="pb-3 pr-4 font-medium">Paar</th>
                <th className="pb-3 pr-4 font-medium">Scope</th>
                <th className="pb-3 pr-4 font-medium">Version</th>
                <th className="pb-3 pr-4 font-medium">Elemente</th>
                <th className="pb-3 pr-4 font-medium">Quarter</th>
                <th className="pb-3 font-medium">Aktivität</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => {
                const scopeTone = board.scope === "MASTER" ? "good" : "neutral";

                return (
                  <tr key={board.id} className="border-b border-border/60 last:border-0">
                    <td className="py-4 pr-4">
                      <div className="font-medium text-foreground">{board.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {board.boardKey}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-foreground">{board.couple.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {board.couple.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="py-4 pr-4">{statusPill(board.scope, scopeTone)}</td>
                    <td className="py-4 pr-4">{board.version}</td>
                    <td className="py-4 pr-4">{board._count.elements}</td>
                    <td className="py-4 pr-4">
                      {board.quarter ? (
                        <div>
                          <div className="font-medium text-foreground">{board.quarter.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(board.quarter.startsAt)} -{" "}
                            {formatDate(board.quarter.endsAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">n/a</span>
                      )}
                    </td>
                    <td className="py-4 text-muted-foreground">{formatDate(board.updatedAt)}</td>
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
