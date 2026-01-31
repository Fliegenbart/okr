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
    : optimisticKeyResults.slice(0, 1);
  const objectiveIcon = getObjectiveIconNode(title, "h-5 w-5");
  const labelPosition = Math.min(Math.max(progress, 4), 96);

  return (
    <Card className="relative rounded-2xl border-border shadow-sm">
      <CelebrationOverlay show={showCelebration} />
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-primary shadow-sm backdrop-blur">
              {objectiveIcon}
            </div>
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
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <details className="group relative">
              <summary className="list-none rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-white/80">
                Aktionen
              </summary>
              <div className="absolute right-0 z-10 mt-2 min-w-[180px] rounded-2xl border border-white/60 bg-white/85 p-2 shadow-lg backdrop-blur-lg">
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

        {nextAction ? (
          <div className="ml-auto max-w-[360px] rounded-2xl border border-primary/20 bg-secondary px-4 py-3 text-primary shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">
              Naechste Aktion
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug">
              {nextAction}
            </p>
          </div>
        ) : null}

        <div className="relative h-2 w-full rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
          <motion.span
            className="absolute top-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
            animate={{ left: `${labelPosition}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 20 }}
            style={{ transform: "translate(-50%, -50%)" }}
          >
            {progress}%
          </motion.span>
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
          <div className="divide-y divide-white/60 rounded-2xl border border-white/60 bg-white/60 backdrop-blur-sm">
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
          {optimisticKeyResults.length > 1 ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllKeyResults((prev) => !prev)}
                className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/60 text-primary shadow-sm backdrop-blur transition hover:bg-white/80"
              >
                <span
                  className={`inline-flex transition-transform ${
                    showAllKeyResults ? "rotate-180" : ""
                  }`}
                >
                  <span
                    className={
                      showAllKeyResults
                        ? ""
                        : "motion-safe:animate-chevron-nudge"
                    }
                  >
                    <ChevronDown className="h-5 w-5" />
                  </span>
                </span>
                <span className="sr-only">
                  {showAllKeyResults
                    ? "Key Results einklappen"
                    : "Key Results ausklappen"}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
