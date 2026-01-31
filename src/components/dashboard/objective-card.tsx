"use client";

import { useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { CelebrationOverlay } from "@/components/dashboard/celebration-overlay";
import { KeyResultQuickUpdateDialog } from "@/components/dashboard/key-result-quick-update-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useObjectiveProgress } from "@/hooks/use-objective-progress";
import { calculateProgress } from "@/lib/progress";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export type KeyResultSummary = {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit?: string | null;
};

type ObjectiveCardProps = {
  objectiveId: string;
  title: string;
  description?: string | null;
  nextAction?: string | null;
  keyResults: KeyResultSummary[];
  insights: {
    lastUpdateAt: string | null;
    updatesLast7: number;
    updatesPrev7: number;
    streakDays: number;
    trend: "up" | "down" | "flat";
  };
};

type OptimisticUpdate = { id: string; value: number };

export function ObjectiveCard({
  objectiveId,
  title,
  description,
  nextAction,
  keyResults,
  insights,
}: ObjectiveCardProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [showAllKeyResults, setShowAllKeyResults] = useState(false);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [optimisticKeyResults, applyOptimistic] = useOptimistic(
    keyResults,
    (state: KeyResultSummary[], update: OptimisticUpdate) => {
      return state.map((item) =>
        item.id === update.id
          ? {
              ...item,
              currentValue: update.value,
            }
          : item
      );
    }
  );

  const progress = useObjectiveProgress(optimisticKeyResults);

  const triggerCelebration = () => {
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
    }
    setShowCelebration(true);
    celebrationTimeoutRef.current = setTimeout(() => {
      setShowCelebration(false);
    }, 2500);
  };

  const handleOptimisticUpdate = (id: string, value: number) => {
    const nextKeyResults = optimisticKeyResults.map((item) =>
      item.id === id
        ? {
            ...item,
            currentValue: value,
          }
        : item
    );
    const nextProgress = calculateProgress(nextKeyResults);

    if (progress < 100 && nextProgress === 100) {
      triggerCelebration();
    }

    applyOptimistic({ id, value });
  };

  const visibleKeyResults = showAllKeyResults
    ? optimisticKeyResults
    : optimisticKeyResults.slice(0, 2);

  return (
    <Card className="relative rounded-2xl border-border shadow-sm">
      <CelebrationOverlay show={showCelebration} />
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Link
              href={`/dashboard/objectives/${objectiveId}`}
              className="text-xl font-semibold text-foreground hover:underline"
            >
              {title}
            </Link>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
            {nextAction ? (
              <div className="rounded-2xl border border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">
                  Naechste Aktion
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {nextAction}
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Fortschritt {progress}%
            </div>
            <details className="group relative">
              <summary className="list-none rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-muted">
                Aktionen
              </summary>
              <div className="absolute right-0 z-10 mt-2 min-w-[180px] rounded-2xl border border-border bg-background p-2 shadow-lg">
                <Link
                  href={`/dashboard/objectives/${objectiveId}`}
                  className="flex items-center rounded-xl px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  Details ansehen
                </Link>
                <Link
                  href={`/dashboard/objectives/${objectiveId}/edit`}
                  className="flex items-center rounded-xl px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  KR anlegen
                </Link>
                <Link
                  href={`/dashboard/objectives/${objectiveId}/edit`}
                  className="flex items-center rounded-xl px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  Objective bearbeiten
                </Link>
                <Link
                  href={`/dashboard/thinking-partner?objectiveId=${objectiveId}`}
                  className="flex items-center rounded-xl px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  Thinking Partner
                </Link>
              </div>
            </details>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1">
            Letztes Update:{" "}
            {insights.lastUpdateAt
              ? dateFormatter.format(new Date(insights.lastUpdateAt))
              : "—"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1">
            Trend:{" "}
            {insights.trend === "up"
              ? `↑ +${insights.updatesLast7 - insights.updatesPrev7}`
              : insights.trend === "down"
                ? `↓ -${insights.updatesPrev7 - insights.updatesLast7}`
                : "→ 0"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1">
            Streak: {insights.streakDays} Tage
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>Key Results</span>
            <span>{optimisticKeyResults.length} KRs</span>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-background">
            {visibleKeyResults.map((keyResult) => {
              const progressValue = keyResult.targetValue
                ? Math.min(
                    Math.round(
                      (keyResult.currentValue / keyResult.targetValue) * 100
                    ),
                    100
                  )
                : 0;

              return (
                <div
                  key={keyResult.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        {keyResult.title}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {progressValue}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {keyResult.currentValue} / {keyResult.targetValue}
                      {keyResult.unit ? ` ${keyResult.unit}` : ""}
                    </p>
                    <div className="h-1.5 w-full rounded-full bg-border">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${progressValue}%` }}
                        transition={{ type: "spring", stiffness: 140, damping: 18 }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/key-results/${keyResult.id}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary"
                    >
                      Details
                    </Link>
                    <KeyResultQuickUpdateDialog
                      keyResultId={keyResult.id}
                      title={keyResult.title}
                      currentValue={keyResult.currentValue}
                      unit={keyResult.unit}
                      buttonSize="sm"
                      buttonClassName="text-xs"
                      onOptimisticUpdate={(value) =>
                        handleOptimisticUpdate(keyResult.id, value)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {optimisticKeyResults.length > 2 ? (
            <button
              type="button"
              onClick={() => setShowAllKeyResults((prev) => !prev)}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
            >
              {showAllKeyResults
                ? "Weniger anzeigen"
                : `Alle ${optimisticKeyResults.length} Key Results anzeigen`}
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
