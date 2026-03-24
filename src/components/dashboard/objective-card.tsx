"use client";

import { useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Compass,
  Dumbbell,
  HeartPulse,
  Home,
  Map,
  PiggyBank,
  Shield,
  Sparkles,
  Target,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";

import { CelebrationOverlay } from "@/components/dashboard/celebration-overlay";
import { KeyResultQuickUpdateDialog } from "@/components/dashboard/key-result-quick-update-dialog";
import { QuarterProgressChart } from "@/components/dashboard/quarter-progress-chart";
import { Card, CardContent } from "@/components/ui/card";
import { useObjectiveProgress } from "@/hooks/use-objective-progress";
import { calculateKeyResultProgress, type KeyResultDirection, type KeyResultType } from "@/lib/key-results";
import type { ObjectiveQuarterProgressSeries } from "@/lib/quarter-progress";
import { calculateProgress, formatProgressPercent } from "@/lib/progress";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export type KeyResultSummary = {
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
  progressSeries?: ObjectiveQuarterProgressSeries | null;
  progressTodayKey?: string | null;
};

type OptimisticUpdate = { id: string; value: number };

const iconMatchers: Array<{
  keywords: string[];
  render: (className?: string) => React.ReactNode;
}> = [
  {
    keywords: ["gesund", "fitness", "sport", "beweg", "wasser"],
    render: (className) => <HeartPulse className={className} />,
  },
  {
    keywords: ["abenteuer", "reise", "ort", "trip", "entdecken"],
    render: (className) => <Compass className={className} />,
  },
  {
    keywords: ["haushalt", "ordnung", "home", "alltag"],
    render: (className) => <Home className={className} />,
  },
  {
    keywords: ["nahe", "intim", "liebe", "verbund", "beziehung"],
    render: (className) => <Sparkles className={className} />,
  },
  {
    keywords: ["konflikt", "repair", "streit", "sicherheit"],
    render: (className) => <Shield className={className} />,
  },
  {
    keywords: ["finanz", "geld", "budget", "spar"],
    render: (className) => <PiggyBank className={className} />,
  },
  {
    keywords: ["zeit", "kalender", "planung", "balance"],
    render: (className) => <Activity className={className} />,
  },
  {
    keywords: ["orte", "reisen", "urlaub", "erlebnis"],
    render: (className) => <Map className={className} />,
  },
  {
    keywords: ["streak", "serie", "routine"],
    render: (className) => <Dumbbell className={className} />,
  },
];

function getObjectiveIconNode(title: string, className?: string) {
  const normalized = title.toLowerCase();
  const matched = iconMatchers.find((matcher) =>
    matcher.keywords.some((keyword) => normalized.includes(keyword))
  );
  return matched?.render(className) ?? <Target className={className} />;
}

export function ObjectiveCard({
  objectiveId,
  title,
  description,
  nextAction,
  keyResults,
  insights,
  progressSeries,
  progressTodayKey,
}: ObjectiveCardProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [showAllKeyResults, setShowAllKeyResults] = useState(false);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    : optimisticKeyResults.slice(0, 1);
  const objectiveIcon = getObjectiveIconNode(title, "h-5 w-5");

  return (
    <Card className="relative overflow-hidden rounded-[2rem] border-white/70">
      <CelebrationOverlay show={showCelebration} />
      <CardContent className="relative space-y-6 p-7">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-b-[2rem] bg-gradient-to-b from-primary/6 to-transparent" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              {objectiveIcon}
            </div>
            <div className="space-y-2">
              <Link
                href={`/dashboard/objectives/${objectiveId}`}
                className="font-display text-2xl font-bold tracking-[-0.04em] text-foreground hover:underline"
              >
                {title}
              </Link>
              {description ? (
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
              ) : null}
              {nextAction ? (
                <div className="rounded-[1.5rem] bg-primary/7 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <p className="dashboard-kicker text-[10px] font-bold text-primary/70">Als Nächstes sinnvoll</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-primary">{nextAction}</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <details className="group relative">
              <summary className="list-none cursor-pointer rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/80">
                Aktionen
              </summary>
              <div className="absolute right-0 z-10 mt-2 min-w-[220px] rounded-2xl border border-white/80 bg-white/96 p-2 shadow-[0_20px_55px_rgba(33,18,33,0.12)] backdrop-blur-sm">
                <Link
                  href={`/dashboard/objectives/${objectiveId}`}
                  className="flex items-center rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Objective öffnen
                </Link>
                <Link
                  href={`/dashboard/objectives/${objectiveId}/edit`}
                  className="flex items-center rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Key Result ergänzen
                </Link>
                <Link
                  href={`/dashboard/objectives/${objectiveId}/edit`}
                  className="flex items-center rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Objective bearbeiten
                </Link>
                <Link
                  href={`/dashboard/thinking-partner?objectiveId=${objectiveId}`}
                  className="flex items-center rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Thinking Partner fragen
                </Link>
              </div>
            </details>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="progress-track relative h-2.5 flex-1 rounded-full">
            <motion.div
              className="progress-fill h-full rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
          </div>
          <span className="rounded-full bg-primary/8 px-3 py-1 text-sm font-semibold text-primary tabular-nums">
            {formatProgressPercent(progress)}%
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            Letztes Update:{" "}
            {insights.lastUpdateAt ? dateFormatter.format(new Date(insights.lastUpdateAt)) : "—"}
          </span>
          <span>
            Trend:{" "}
            {insights.trend === "up"
              ? `↑ +${insights.updatesLast7 - insights.updatesPrev7}`
              : insights.trend === "down"
                ? `↓ -${insights.updatesPrev7 - insights.updatesLast7}`
                : "→ 0"}
          </span>
          <span>Seit {insights.streakDays} Tagen in Folge dran</span>
        </div>

        {progressSeries ? (
          <Link
            href={`/dashboard/objectives/${objectiveId}`}
            className="block overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(33,18,33,0.08)]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="dashboard-kicker text-[10px] font-extrabold text-primary">
                  Objective-Verlauf
                </p>
                <p className="text-xs text-muted-foreground">
                  {progressSeries.lastUpdateAt
                    ? `Letztes Update: ${dateFormatter.format(new Date(progressSeries.lastUpdateAt))}`
                    : "Noch keine Updates"}
                </p>
              </div>
              <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                {formatProgressPercent(progressSeries.currentProgress)}%
              </span>
            </div>
            <QuarterProgressChart
              data={progressSeries.points}
              todayKey={progressTodayKey}
              compact={true}
              showAxes={false}
            />
          </Link>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Key Results</span>
            <span>{optimisticKeyResults.length} insgesamt</span>
          </div>
          <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {visibleKeyResults.map((keyResult) => {
              const progressValue = calculateKeyResultProgress(keyResult);

              return (
                <div
                  key={keyResult.id}
                  className="flex flex-col gap-3 border-t border-border/70 p-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{keyResult.title}</p>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        {formatProgressPercent(progressValue)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {keyResult.currentValue} / {keyResult.targetValue}
                      {keyResult.unit ? ` ${keyResult.unit}` : ""}
                    </p>
                    <div className="progress-track h-2 w-full rounded-full">
                      <motion.div
                        className="progress-fill h-full rounded-full"
                        animate={{ width: `${progressValue}%` }}
                        transition={{ type: "spring", stiffness: 140, damping: 18 }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/key-results/${keyResult.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Details
                    </Link>
                    <KeyResultQuickUpdateDialog
                      keyResultId={keyResult.id}
                      title={keyResult.title}
                      currentValue={keyResult.currentValue}
                      type={keyResult.type}
                      unit={keyResult.unit}
                      buttonSize="sm"
                      buttonClassName="text-xs"
                      onOptimisticUpdate={(value) => handleOptimisticUpdate(keyResult.id, value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {optimisticKeyResults.length > 1 ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllKeyResults((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
              >
                <span
                  className={`inline-flex transition-transform ${
                    showAllKeyResults ? "rotate-180" : ""
                  }`}
                >
                  <ChevronDown className="h-4 w-4" />
                </span>
                <span className="sr-only">
                  {showAllKeyResults ? "Key Results einklappen" : "Key Results ausklappen"}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
