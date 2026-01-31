export type ObjectiveInsights = {
  lastUpdateAt: Date | null;
  updatesLast7: number;
  updatesPrev7: number;
  streakDays: number;
  trend: "up" | "down" | "flat";
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getObjectiveInsights(
  updates: { createdAt: Date }[]
): ObjectiveInsights {
  if (!updates.length) {
    return {
      lastUpdateAt: null,
      updatesLast7: 0,
      updatesPrev7: 0,
      streakDays: 0,
      trend: "flat",
    };
  }

  const sorted = [...updates].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const lastUpdateAt = sorted[0].createdAt;
  const today = startOfDay(new Date());
  const last7Start = new Date(today.getTime() - 6 * DAY_MS);
  const prev7Start = new Date(today.getTime() - 13 * DAY_MS);
  const prev7End = new Date(today.getTime() - 7 * DAY_MS);

  const updatesLast7 = sorted.filter(
    (update) => update.createdAt >= last7Start
  ).length;
  const updatesPrev7 = sorted.filter(
    (update) => update.createdAt >= prev7Start && update.createdAt < prev7End
  ).length;

  let trend: ObjectiveInsights["trend"] = "flat";
  if (updatesLast7 > updatesPrev7) trend = "up";
  if (updatesLast7 < updatesPrev7) trend = "down";

  const daysWithUpdates = new Set(
    sorted.map((update) => startOfDay(update.createdAt).toISOString())
  );

  let streakDays = 0;
  for (let i = 0; i < 365; i += 1) {
    const day = new Date(today.getTime() - i * DAY_MS);
    const key = day.toISOString();
    if (daysWithUpdates.has(key)) {
      streakDays += 1;
    } else {
      break;
    }
  }

  return {
    lastUpdateAt,
    updatesLast7,
    updatesPrev7,
    streakDays,
    trend,
  };
}
