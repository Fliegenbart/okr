import Link from "next/link";
import { notFound } from "next/navigation";

import { KeyResultChart } from "@/components/dashboard/key-result-chart";
import { SimpleRichTextContent } from "@/components/dashboard/simple-rich-text";
import { KeyResultUpdateForm } from "@/components/dashboard/key-result-update-form";
import { Card, CardContent } from "@/components/ui/card";
import {
  redirectForMissingCouple,
  requireDashboardSubpageAccess,
} from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";
import {
  getKeyResultDirectionLabel,
  getKeyResultSummaryText,
  getKeyResultTypeLabel,
} from "@/lib/key-results";

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
  const viewer = await requireDashboardSubpageAccess(`/dashboard/key-results/${resolvedParams.id}`);

  const keyResult = await prisma.keyResult.findFirst({
    where: {
      id: resolvedParams.id,
      archivedAt: null,
      objective: {
        coupleId: viewer.activeCoupleId,
        archivedAt: null,
      },
    },
    include: {
      objective: {
        include: {
          quarter: true,
        },
      },
      updates: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!keyResult) {
    const couple = await prisma.couple.findUnique({
      where: { id: viewer.activeCoupleId },
      select: { id: true },
    });

    if (!couple) {
      redirectForMissingCouple(viewer);
    }

    return notFound();
  }

  const sortedUpdates = [...keyResult.updates].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const chartData = sortedUpdates.map((update) => ({
    date: update.createdAt.toISOString(),
    value: update.value,
  }));

  const activityUpdates = [...sortedUpdates]
    .reverse()
    .map((update, index, list) => {
      const previousValue =
        update.previousValue ??
        list[index + 1]?.value ??
        keyResult.startValue;
      return {
        id: update.id,
        value: update.value,
        previousValue,
        note: update.note,
        createdAt: dateTimeFormatter.format(update.createdAt),
      };
    });

  const startValue = keyResult.startValue;

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
          <p className="text-sm uppercase tracking-[0.2em] text-primary">
            {keyResult.objective.title}
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            {keyResult.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {getKeyResultSummaryText(keyResult)}
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
                {keyResult.type === "BINARY" ? "Ja / Nein" : keyResult.targetValue}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                Typ
              </p>
              <p className="text-lg font-semibold text-foreground">
                {getKeyResultTypeLabel(keyResult.type)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">Richtung</p>
              <p className="text-lg font-semibold text-foreground">
                {getKeyResultDirectionLabel(keyResult.direction)}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-sm sm:col-span-2">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">Beschreibung</p>
              {keyResult.description ? (
                <SimpleRichTextContent value={keyResult.description} />
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Beschreibung hinterlegt.</p>
              )}
            </CardContent>
          </Card>
        </div>
        {keyResult.type === "TRAFFIC_LIGHT" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ampel-Regel: rot bei {keyResult.redThreshold ?? "—"}, gelb bei{" "}
            {keyResult.yellowThreshold ?? "—"}, grün bei {keyResult.greenThreshold ?? "—"}
            {keyResult.unit ? ` ${keyResult.unit}` : ""}.
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr,0.6fr]">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Verlauf
              </p>
              <KeyResultChart
                data={chartData}
                type={keyResult.type}
                direction={keyResult.direction}
                targetValue={keyResult.targetValue}
                startValue={keyResult.startValue}
                quarterStartsAt={keyResult.objective.quarter.startsAt.toISOString()}
                quarterEndsAt={keyResult.objective.quarter.endsAt.toISOString()}
                redThreshold={keyResult.redThreshold}
                yellowThreshold={keyResult.yellowThreshold}
                greenThreshold={keyResult.greenThreshold}
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
                type={keyResult.type}
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
