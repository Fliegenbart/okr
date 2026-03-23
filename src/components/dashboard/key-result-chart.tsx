"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getBinaryValue,
  getKeyResultTypeLabel,
  getTrafficLightStatus,
  type KeyResultDirection,
  type KeyResultType,
} from "@/lib/key-results";

type ChartPoint = {
  date: string;
  value: number;
};

type KeyResultChartProps = {
  data: ChartPoint[];
  type: KeyResultType;
  direction: KeyResultDirection;
  targetValue: number;
  startValue: number;
  quarterStartsAt: string;
  quarterEndsAt: string;
  redThreshold?: number | null;
  yellowThreshold?: number | null;
  greenThreshold?: number | null;
  unit?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
});

function formatDate(value: number) {
  return dateFormatter.format(new Date(value));
}

function buildMonthlyTicks(startsAt: Date, endsAt: Date) {
  const ticks: number[] = [startsAt.getTime()];
  const current = new Date(startsAt);
  current.setUTCDate(1);
  current.setUTCMonth(current.getUTCMonth() + 1);

  while (current < endsAt) {
    ticks.push(current.getTime());
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  ticks.push(endsAt.getTime());
  return Array.from(new Set(ticks)).sort((left, right) => left - right);
}

type TooltipPayload = {
  value: number;
  payload: { time: number; value: number };
};

function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
  unit?: string | null;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const formattedDate = typeof label === "number" ? formatDate(label) : "";

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-2 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-primary">{formattedDate}</p>
      <p className="text-sm font-semibold text-foreground">
        {item.value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

export function KeyResultChart({
  data,
  type,
  direction,
  targetValue,
  startValue,
  quarterStartsAt,
  quarterEndsAt,
  redThreshold,
  yellowThreshold,
  greenThreshold,
  unit,
}: KeyResultChartProps) {
  const quarterStart = useMemo(() => new Date(quarterStartsAt), [quarterStartsAt]);
  const quarterEnd = useMemo(() => new Date(quarterEndsAt), [quarterEndsAt]);
  const ticks = useMemo(() => buildMonthlyTicks(quarterStart, quarterEnd), [quarterEnd, quarterStart]);

  const normalizedData = useMemo(() => {
    const basePoints = data.map((point) => ({
      time: new Date(point.date).getTime(),
      value: type === "BINARY" ? getBinaryValue(point.value) : point.value,
    }));

    const firstPoint = {
      time: quarterStart.getTime(),
      value: type === "BINARY" ? getBinaryValue(startValue) : startValue,
    };
    const lastValue = basePoints.length ? basePoints[basePoints.length - 1].value : firstPoint.value;
    const lastPoint = {
      time: quarterEnd.getTime(),
      value: lastValue,
    };

    return [firstPoint, ...basePoints, lastPoint]
      .filter((point, index, array) => index === 0 || point.time !== array[index - 1].time)
      .sort((left, right) => left.time - right.time);
  }, [data, quarterEnd, quarterStart, startValue, type]);

  const domainValues = [
    ...normalizedData.map((point) => point.value),
    targetValue,
    startValue,
    redThreshold ?? undefined,
    yellowThreshold ?? undefined,
    greenThreshold ?? undefined,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const maxValue = Math.max(...domainValues, 1);
  const yMax = type === "BINARY" ? 1.2 : Math.max(maxValue * 1.15, 3);
  const yDomain: [number, number] = [0, yMax];
  const trafficLightStatus =
    normalizedData.length > 0
      ? getTrafficLightStatus({
          type,
          direction,
          currentValue: normalizedData[normalizedData.length - 1].value,
          targetValue,
          redThreshold,
          yellowThreshold,
          greenThreshold,
        })
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>{getKeyResultTypeLabel(type)}</span>
        <span>
          {dateFormatter.format(quarterStart)} - {dateFormatter.format(quarterEnd)}
        </span>
      </div>
      {type === "TRAFFIC_LIGHT" && trafficLightStatus ? (
        <p className="text-sm text-muted-foreground">
          Aktuelle Ampel:{" "}
          <span
            className={
              trafficLightStatus === "green"
                ? "text-emerald-600"
                : trafficLightStatus === "yellow"
                  ? "text-amber-600"
                  : "text-rose-600"
            }
          >
            {trafficLightStatus === "green"
              ? "Grün"
              : trafficLightStatus === "yellow"
                ? "Gelb"
                : "Rot"}
          </span>
        </p>
      ) : null}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={normalizedData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#e8edf5" vertical strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="time"
              domain={[quarterStart.getTime(), quarterEnd.getTime()]}
              ticks={ticks}
              tickFormatter={formatDate}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#5f708f", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#5f708f", fontSize: 12 }}
              width={36}
              domain={yDomain}
              allowDecimals={type !== "BINARY"}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />

            {type === "STAY_ABOVE" ? (
              <>
                <ReferenceArea y1={0} y2={targetValue} fill="#ffe1e6" fillOpacity={0.7} />
                <ReferenceArea y1={targetValue} y2={yMax} fill="#dcfce7" fillOpacity={0.6} />
                <ReferenceLine
                  y={targetValue}
                  stroke="#0f62fe"
                  strokeDasharray="4 4"
                  label={{ value: "Mindestwert", position: "top", fill: "#0f62fe", fontSize: 12 }}
                />
              </>
            ) : null}

            {type === "STAY_BELOW" ? (
              <>
                <ReferenceArea y1={0} y2={targetValue} fill="#dcfce7" fillOpacity={0.6} />
                <ReferenceArea y1={targetValue} y2={yMax} fill="#ffe1e6" fillOpacity={0.7} />
                <ReferenceLine
                  y={targetValue}
                  stroke="#0f62fe"
                  strokeDasharray="4 4"
                  label={{ value: "Maximalwert", position: "top", fill: "#0f62fe", fontSize: 12 }}
                />
              </>
            ) : null}

            {type === "TRAFFIC_LIGHT" &&
            redThreshold !== null &&
            redThreshold !== undefined &&
            yellowThreshold !== null &&
            yellowThreshold !== undefined &&
            greenThreshold !== null &&
            greenThreshold !== undefined ? (
              direction === "LOWER_IS_BETTER" ? (
                <>
                  <ReferenceArea y1={0} y2={greenThreshold} fill="#dcfce7" fillOpacity={0.7} />
                  <ReferenceArea
                    y1={greenThreshold}
                    y2={yellowThreshold}
                    fill="#fef3c7"
                    fillOpacity={0.7}
                  />
                  <ReferenceArea y1={yellowThreshold} y2={yMax} fill="#ffe1e6" fillOpacity={0.8} />
                </>
              ) : (
                <>
                  <ReferenceArea y1={0} y2={redThreshold} fill="#ffe1e6" fillOpacity={0.8} />
                  <ReferenceArea
                    y1={redThreshold}
                    y2={yellowThreshold}
                    fill="#fef3c7"
                    fillOpacity={0.7}
                  />
                  <ReferenceArea y1={yellowThreshold} y2={yMax} fill="#dcfce7" fillOpacity={0.7} />
                </>
              )
            ) : null}

            {type === "INCREASE_TO" ? (
              <ReferenceLine
                y={targetValue}
                stroke="#52c1f3"
                strokeDasharray="4 4"
                label={{ value: "Zielwert", position: "top", fill: "#52c1f3", fontSize: 12 }}
              />
            ) : null}

            {type === "BINARY" ? (
              <ReferenceLine
                y={1}
                stroke="#52c1f3"
                strokeDasharray="4 4"
                label={{ value: "Erreicht", position: "top", fill: "#52c1f3", fontSize: 12 }}
              />
            ) : null}

            <Area
              type="linear"
              dataKey="value"
              stroke="#0f62fe"
              strokeWidth={3}
              fill="#bfd4ff"
              fillOpacity={0.45}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
