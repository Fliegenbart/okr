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

  return (
    <Card className="relative rounded-2xl border-border shadow-sm">
      <CelebrationOverlay show={showCelebration} />
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/dashboard/objectives/${objectiveId}`}
              className="text-lg font-semibold text-foreground hover:underline"
            >
              {title}
            </Link>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2 text-sm font-medium text-foreground">
            <span>{progress}%</span>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-primary">
              <Link href={`/dashboard/objectives/${objectiveId}`}>
                Details
              </Link>
              <Link href={`/dashboard/objectives/${objectiveId}/edit`}>
                KR anlegen
              </Link>
              <Link href={`/dashboard/objectives/${objectiveId}/edit`}>
                Bearbeiten
              </Link>
            </div>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </div>

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

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            Letztes Update:{" "}
            {insights.lastUpdateAt
              ? dateFormatter.format(new Date(insights.lastUpdateAt))
              : "—"}
          </span>
          <span>
            Trend:{" "}
            {insights.trend === "up"
              ? `↑ +${insights.updatesLast7 - insights.updatesPrev7}`
              : insights.trend === "down"
                ? `↓ -${insights.updatesPrev7 - insights.updatesLast7}`
                : "→ 0"}
          </span>
          <span>Streak: {insights.streakDays} Tage</span>
        </div>

        <div className="space-y-4">
          {optimisticKeyResults.map((keyResult) => {
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
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {keyResult.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {keyResult.currentValue} / {keyResult.targetValue}
                      {keyResult.unit ? ` ${keyResult.unit}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/key-results/${keyResult.id}`}
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
                    >
                      Details
                    </Link>
                    <KeyResultQuickUpdateDialog
                      keyResultId={keyResult.id}
                      title={keyResult.title}
                      currentValue={keyResult.currentValue}
                      unit={keyResult.unit}
                      onOptimisticUpdate={(value) =>
                        handleOptimisticUpdate(keyResult.id, value)
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 h-2 w-full rounded-full bg-border">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${progressValue}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 18 }}
                  />
                </div>

              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
