import { calculateProgress } from "@/lib/progress";
import type { KeyResultDirection, KeyResultType } from "@/lib/key-results";

type QuarterInput = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
};

type KeyResultUpdateInput = {
  value: number;
  previousValue: number | null;
  createdAt: Date;
};

type KeyResultInput = {
  id: string;
  currentValue: number;
  targetValue: number;
  startValue: number;
  type: KeyResultType;
  direction: KeyResultDirection;
  redThreshold?: number | null;
  yellowThreshold?: number | null;
  greenThreshold?: number | null;
  updates: KeyResultUpdateInput[];
};

type ObjectiveInput = {
  id: string;
  title: string;
  createdAt: Date;
  keyResults: KeyResultInput[];
};

export type QuarterProgressPoint = {
  date: string;
  actualProgress: number | null;
  idealProgress: number | null;
  hasUpdate: boolean;
};

export type ObjectiveQuarterProgressSeries = {
  id: string;
  title: string;
  currentProgress: number;
  lastUpdateAt: string | null;
  hasAnyUpdate: boolean;
  points: QuarterProgressPoint[];
};

export type QuarterProgressSnapshot = {
  quarterTitle: string;
  quarterStartsAt: string;
  quarterEndsAt: string;
  todayKey: string | null;
  totalObjectives: number;
  objectivesWithoutUpdates: number;
  daysElapsed: number;
  daysRemaining: number;
  averageProgress: number;
  aggregateSeries: QuarterProgressPoint[];
  objectiveSeries: ObjectiveQuarterProgressSeries[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function endOfUtcDay(value: Date) {
  return new Date(startOfUtcDay(value).getTime() + DAY_MS - 1);
}

function addUtcDays(value: Date, days: number) {
  return new Date(startOfUtcDay(value).getTime() + days * DAY_MS);
}

function formatDateKey(value: Date) {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

function diffUtcDays(start: Date, end: Date) {
  return Math.round(
    (startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / DAY_MS
  );
}

function roundProgress(value: number) {
  return Math.round(value * 10) / 10;
}

function enumerateQuarterDays(startsAt: Date, endsAt: Date) {
  const totalDays = diffUtcDays(startsAt, endsAt);

  return Array.from({ length: totalDays + 1 }, (_, index) =>
    addUtcDays(startsAt, index)
  );
}

function buildIdealProgress(day: Date, startAt: Date, endsAt: Date) {
  const normalizedDay = startOfUtcDay(day);
  const normalizedStart = startOfUtcDay(startAt);
  const normalizedEnd = startOfUtcDay(endsAt);

  if (normalizedDay < normalizedStart || normalizedDay > normalizedEnd) {
    return null;
  }

  const totalSpanDays = diffUtcDays(normalizedStart, normalizedEnd);
  if (totalSpanDays <= 0) {
    return 100;
  }

  const elapsedDays = diffUtcDays(normalizedStart, normalizedDay);
  return roundProgress((elapsedDays / totalSpanDays) * 100);
}

function getObjectiveStartDate(
  objectiveCreatedAt: Date,
  quarterStartsAt: Date,
  firstUpdateAt: Date | null
) {
  const earliestRelevantDate =
    firstUpdateAt && firstUpdateAt < objectiveCreatedAt
      ? firstUpdateAt
      : objectiveCreatedAt;

  return startOfUtcDay(
    earliestRelevantDate > quarterStartsAt ? earliestRelevantDate : quarterStartsAt
  );
}

function getKeyResultStartValue(keyResult: KeyResultInput) {
  if (typeof keyResult.startValue === "number") {
    return keyResult.startValue;
  }
  const firstUpdate = [...keyResult.updates].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  )[0];

  if (!firstUpdate) {
    return keyResult.currentValue;
  }

  return firstUpdate.previousValue ?? firstUpdate.value;
}

function buildObjectiveSeries(
  objective: ObjectiveInput,
  quarter: QuarterInput,
  now: Date
): ObjectiveQuarterProgressSeries {
  const actualEnd = startOfUtcDay(
    now < quarter.endsAt ? now : quarter.endsAt
  );
  const allUpdates = objective.keyResults.flatMap((keyResult) => keyResult.updates);
  const firstUpdateAt = allUpdates.length
    ? new Date(
        Math.min(...allUpdates.map((update) => update.createdAt.getTime()))
      )
    : null;
  const objectiveStart = getObjectiveStartDate(
    objective.createdAt,
    quarter.startsAt,
    firstUpdateAt
  );
  const quarterDays = enumerateQuarterDays(quarter.startsAt, quarter.endsAt);
  const sortedKeyResults = objective.keyResults.map((keyResult) => ({
    ...keyResult,
    startValue: getKeyResultStartValue(keyResult),
    updates: [...keyResult.updates].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
    ),
  }));

  const points = quarterDays.map((day) => {
    const dateKey = formatDateKey(day);
    const isWithinObjectiveWindow = day >= objectiveStart;
    const isActualDay = isWithinObjectiveWindow && day <= actualEnd;

    const progressItems = isActualDay
      ? sortedKeyResults.map((keyResult) => {
          let value = keyResult.startValue;

          for (const update of keyResult.updates) {
            if (update.createdAt <= endOfUtcDay(day)) {
              value = update.value;
              continue;
            }

            break;
          }

          return {
            currentValue: value,
            targetValue: keyResult.targetValue,
            startValue: keyResult.startValue,
            type: keyResult.type,
            direction: keyResult.direction,
            redThreshold: keyResult.redThreshold,
            yellowThreshold: keyResult.yellowThreshold,
            greenThreshold: keyResult.greenThreshold,
          };
        })
      : [];

    const hasUpdate = sortedKeyResults.some((keyResult) =>
      keyResult.updates.some((update) => formatDateKey(update.createdAt) === dateKey)
    );

    return {
      date: dateKey,
      actualProgress: isActualDay ? calculateProgress(progressItems) : null,
      idealProgress: buildIdealProgress(day, objectiveStart, quarter.endsAt),
      hasUpdate,
    };
  });

  const latestActualPoint = [...points]
    .reverse()
    .find((point) => point.actualProgress !== null);
  const lastUpdateAt = allUpdates.length
    ? new Date(
        Math.max(...allUpdates.map((update) => update.createdAt.getTime()))
      ).toISOString()
    : null;

  return {
    id: objective.id,
    title: objective.title,
    currentProgress: latestActualPoint?.actualProgress ?? 0,
    lastUpdateAt,
    hasAnyUpdate: allUpdates.length > 0,
    points,
  };
}

export function buildQuarterProgressSnapshot({
  quarter,
  objectives,
  now = new Date(),
}: {
  quarter: QuarterInput;
  objectives: ObjectiveInput[];
  now?: Date;
}): QuarterProgressSnapshot {
  const normalizedNow = startOfUtcDay(now);
  const todayKey =
    normalizedNow >= startOfUtcDay(quarter.startsAt) &&
    normalizedNow <= startOfUtcDay(quarter.endsAt)
      ? formatDateKey(normalizedNow)
      : null;
  const objectiveSeries = objectives.map((objective) =>
    buildObjectiveSeries(objective, quarter, normalizedNow)
  );
  const aggregateSeries = enumerateQuarterDays(quarter.startsAt, quarter.endsAt).map(
    (day) => {
      const dateKey = formatDateKey(day);
      const valuesForDay = objectiveSeries
        .map((objective) => objective.points.find((point) => point.date === dateKey))
        .filter((point): point is QuarterProgressPoint => Boolean(point));

      const actualValues = valuesForDay
        .map((point) => point.actualProgress)
        .filter((value): value is number => value !== null);
      const idealValues = valuesForDay
        .map((point) => point.idealProgress)
        .filter((value): value is number => value !== null);

      return {
        date: dateKey,
        actualProgress: actualValues.length
          ? roundProgress(
              actualValues.reduce((sum, value) => sum + value, 0) /
                actualValues.length
            )
          : null,
        idealProgress: idealValues.length
          ? roundProgress(
              idealValues.reduce((sum, value) => sum + value, 0) /
                idealValues.length
            )
          : null,
        hasUpdate: valuesForDay.some((point) => point.hasUpdate),
      };
    }
  );

  const lastActualAggregatePoint = [...aggregateSeries]
    .reverse()
    .find((point) => point.actualProgress !== null);
  const quarterTotalDays = diffUtcDays(quarter.startsAt, quarter.endsAt) + 1;
  const effectiveEnd = normalizedNow < quarter.endsAt ? normalizedNow : quarter.endsAt;
  const daysElapsed =
    effectiveEnd < quarter.startsAt
      ? 0
      : Math.min(quarterTotalDays, diffUtcDays(quarter.startsAt, effectiveEnd) + 1);
  const daysRemaining =
    normalizedNow > quarter.endsAt
      ? 0
      : Math.max(0, diffUtcDays(normalizedNow, quarter.endsAt));

  return {
    quarterTitle: quarter.title,
    quarterStartsAt: quarter.startsAt.toISOString(),
    quarterEndsAt: quarter.endsAt.toISOString(),
    todayKey,
    totalObjectives: objectiveSeries.length,
    objectivesWithoutUpdates: objectiveSeries.filter(
      (objective) => !objective.hasAnyUpdate
    ).length,
    daysElapsed,
    daysRemaining,
    averageProgress: lastActualAggregatePoint?.actualProgress ?? 0,
    aggregateSeries,
    objectiveSeries,
  };
}
