"use client";

import { useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { CelebrationOverlay } from "@/components/dashboard/celebration-overlay";
import { CommitmentStatusActions } from "@/components/dashboard/commitment-status-actions";
import { KeyResultQuickUpdateDialog } from "@/components/dashboard/key-result-quick-update-dialog";
import { ObjectiveTrafficLightChip } from "@/components/dashboard/objective-traffic-light-chip";
import { TrafficLightChip } from "@/components/dashboard/traffic-light-chip";
import { Card, CardContent } from "@/components/ui/card";
import { useObjectiveProgress } from "@/hooks/use-objective-progress";
import {
  calculateKeyResultProgress,
  type KeyResultDirection,
  type KeyResultType,
} from "@/lib/key-results";
import { calculateProgress, formatProgressPercent } from "@/lib/progress";

export type ObjectiveDetailProps = {
  objectiveId: string;
  title: string;
  description?: string | null;
  quarterTitle: string;
  nextAction?: string | null;
  keyResults: {
    id: string;
    title: string;
    currentValue: number;
    targetValue: number;
    startValue: number;
    type: KeyResultType;
    direction: KeyResultDirection;
    redThreshold?: number | null;
    yellowThreshold?: number | null;
    greenThreshold?: number | null;
    unit?: string | null;
  }[];
  commitments?: {
    id: string;
    title: string;
    status: string;
    dueAt?: string | null;
    ownerName?: string | null;
  }[];
};

type OptimisticUpdate = { id: string; value: number };

export function ObjectiveDetail({
  objectiveId,
  title,
  description,
  quarterTitle,
  nextAction,
  keyResults,
  commitments = [],
}: ObjectiveDetailProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [optimisticKeyResults, applyOptimistic] = useOptimistic(
    keyResults,
    (state: ObjectiveDetailProps["keyResults"], update: OptimisticUpdate) => {
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
    <div className="space-y-8">
      <Card className="relative rounded-2xl border-border shadow-sm">
        <CelebrationOverlay show={showCelebration} />
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary">{quarterTitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
                <ObjectiveTrafficLightChip keyResults={optimisticKeyResults} />
              </div>
              {description ? (
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              ) : null}
              {nextAction ? (
                <p className="mt-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
                  <span className="font-semibold text-primary">Als Nächstes sinnvoll:</span>{" "}
                  {nextAction}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm uppercase tracking-[0.2em] text-primary">Fortschritt</p>
                <p className="text-3xl font-semibold text-foreground">
                  {formatProgressPercent(progress)}%
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 text-xs uppercase tracking-[0.2em] text-primary">
                <Link href={`/dashboard/thinking-partner?objectiveId=${objectiveId}`}>
                  OKR-Coach fragen
                </Link>
                <Link href={`/dashboard/objectives/${objectiveId}/edit`}>Bearbeiten</Link>
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
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Key Results</h2>
          <Link
            href={`/dashboard/objectives/${objectiveId}/edit`}
            className="text-xs uppercase tracking-[0.2em] text-primary"
          >
            Key Result ergänzen
          </Link>
        </div>

        <div className="space-y-4">
          {optimisticKeyResults.map((keyResult) => {
            const progressValue = calculateKeyResultProgress(keyResult);

            return (
              <Card key={keyResult.id} className="rounded-2xl border-border shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">{keyResult.title}</p>
                        <TrafficLightChip keyResult={keyResult} />
                      </div>
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
                        type={keyResult.type}
                        unit={keyResult.unit}
                        onOptimisticUpdate={(value) => handleOptimisticUpdate(keyResult.id, value)}
                      />
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-border">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: `${progressValue}%` }}
                      transition={{ type: "spring", stiffness: 140, damping: 18 }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {commitments.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Zusagen</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-primary">Dranbleiben</span>
          </div>

          <div className="space-y-4">
            {commitments.map((commitment) => (
              <Card key={commitment.id} className="rounded-2xl border-border shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">{commitment.title}</p>
                      <p className="text-xs text-muted-foreground">Status: {commitment.status}</p>
                      {commitment.ownerName ? (
                        <p className="text-xs text-muted-foreground">
                          Verantwortlich: {commitment.ownerName}
                        </p>
                      ) : null}
                      {commitment.dueAt ? (
                        <p className="text-xs text-muted-foreground">
                          Fällig: {new Date(commitment.dueAt).toLocaleDateString("de-DE")}
                        </p>
                      ) : null}
                    </div>
                    {commitment.status === "OPEN" ? (
                      <CommitmentStatusActions commitmentId={commitment.id} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
