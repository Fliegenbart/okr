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
import { Card, CardContent } from "@/components/ui/card";
import { useObjectiveProgress } from "@/hooks/use-objective-progress";
import { calculateKeyResultProgress, type KeyResultDirection, type KeyResultType } from "@/lib/key-results";
import { calculateProgress } from "@/lib/progress";

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
    <Card className="dashboard-panel relative overflow-hidden rounded-[1.75rem] border-border/70">
      <CelebrationOverlay show={showCelebration} />
      <CardContent className="relative space-y-5 p-5 sm:space-y-6 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-11 sm:w-11">
              {objectiveIcon}
            </div>
            <div className="space-y-2">
              <Link
                href={`/dashboard/objectives/${objectiveId}`}
                className="text-lg font-semibold leading-7 text-foreground hover:underline sm:text-xl"
              >
                {title}
              </Link>
              {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
              {nextAction ? (
                <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">
                    Als Naechstes sinnvoll
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-primary">{nextAction}</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <details className="group relative">
              <summary className="list-none cursor-pointer rounded-xl bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/80">
                Aktionen
              </summary>
              <div className="absolute right-0 z-10 mt-2 min-w-[180px] rounded-2xl border border-border bg-white p-1.5 shadow-lg">
                <Link
                  href={`/dashboard/objectives/${objectiveId}`}
                  className="flex items-center rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Objective öffnen
                </Link>
                <Link
                  href={`/dashboard/objectives/${objectiveId}/edit`}
                  className="flex items-center rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Key Result ergänzen
                </Link>
                <Link
                  href={`/dashboard/objectives/${objectiveId}/edit`}
                  className="flex items-center rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Objective bearbeiten
                </Link>
                <Link
                  href={`/dashboard/thinking-partner?objectiveId=${objectiveId}`}
                  className="flex items-center rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  Thinking Partner fragen
                </Link>
              </div>
            </details>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative h-2 flex-1 rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary shadow-[0_8px_18px_rgba(242,0,128,0.25)]"
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
          </div>
          <span className="text-sm font-medium text-foreground tabular-nums">{progress}%</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
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

        <div className="space-y-3 rounded-[1.5rem] bg-muted/35 p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Key Results</span>
            <span>{optimisticKeyResults.length} insgesamt</span>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-white">
            {visibleKeyResults.map((keyResult) => {
              const progressValue = calculateKeyResultProgress(keyResult);

              return (
                <div
                  key={keyResult.id}
                  className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground sm:text-base">{keyResult.title}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {progressValue}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {keyResult.currentValue} / {keyResult.targetValue}
                      {keyResult.unit ? ` ${keyResult.unit}` : ""}
                    </p>
                    <div className="h-2 w-full rounded-full bg-border">
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-muted-foreground transition-colors hover:bg-muted/80"
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
