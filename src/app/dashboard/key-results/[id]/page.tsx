import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { KeyResultChart } from "@/components/dashboard/key-result-chart";
import { KeyResultUpdateForm } from "@/components/dashboard/key-result-update-form";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function KeyResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { coupleId: true },
  });

  if (!user?.coupleId) {
    return notFound();
  }

  const keyResult = await prisma.keyResult.findFirst({
    where: {
      id: resolvedParams.id,
      archivedAt: null,
      objective: {
        coupleId: user.coupleId,
        archivedAt: null,
      },
    },
    include: {
      objective: true,
      updates: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!keyResult) {
    return notFound();
  }

  const sortedUpdates = [...keyResult.updates].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const chartData = sortedUpdates.length
    ? (() => {
        const [first, ...rest] = sortedUpdates;
        const data = [];
        if (first.previousValue !== null && first.previousValue !== undefined) {
          data.push({
            date: new Date(first.createdAt.getTime() - 60 * 1000).toISOString(),
            value: first.previousValue,
          });
        }
        data.push({
          date: first.createdAt.toISOString(),
          value: first.value,
        });
        rest.forEach((update) => {
          data.push({
            date: update.createdAt.toISOString(),
            value: update.value,
          });
        });
        return data;
      })()
    : [
        {
          date: keyResult.updatedAt.toISOString(),
          value: keyResult.currentValue,
        },
      ];

  const activityUpdates = [...sortedUpdates]
    .reverse()
    .map((update, index, list) => {
      const previousValue =
        update.previousValue ??
        list[index + 1]?.value ??
        update.previousValue ??
        0;
      return {
        id: update.id,
        value: update.value,
        previousValue,
        note: update.note,
        createdAt: dateTimeFormatter.format(update.createdAt),
      };
    });

  const startValue =
    sortedUpdates[0]?.previousValue ?? sortedUpdates[0]?.value ?? 0;

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
          <p className="text-sm uppercase tracking-[0.2em] text-primary">
            {keyResult.objective.title}
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            {keyResult.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Aktuell {keyResult.currentValue} von {keyResult.targetValue}
            {keyResult.unit ? ` ${keyResult.unit}` : ""}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/dashboard/thinking-partner?keyResultId=${keyResult.id}`}
              className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground"
            >
              Thinking Partner
            </Link>
            <Link
              href={`/dashboard/objectives/${keyResult.objective.id}/edit`}
              className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground"
            >
              Bearbeiten
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                Start
              </p>
              <p className="text-lg font-semibold text-foreground">
                {startValue}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                Aktuell
              </p>
              <p className="text-lg font-semibold text-foreground">
                {keyResult.currentValue}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                Ziel
              </p>
              <p className="text-lg font-semibold text-foreground">
                {keyResult.targetValue}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                Einheit
              </p>
              <p className="text-lg font-semibold text-foreground">
                {keyResult.unit ? keyResult.unit : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr,0.6fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Verlauf
              </p>
              <KeyResultChart
                data={chartData}
                targetValue={keyResult.targetValue}
                unit={keyResult.unit}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Update erfassen
              </p>
              <KeyResultUpdateForm
                keyResultId={keyResult.id}
                currentValue={keyResult.currentValue}
                unit={keyResult.unit}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">
              Letzte Updates
            </p>
            {activityUpdates.length ? (
              <div className="space-y-3">
                {activityUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {update.previousValue} → {update.value}
                      </p>
                      {update.note ? (
                        <p className="text-xs text-muted-foreground">
                          {update.note}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {update.createdAt}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Updates erfasst.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
