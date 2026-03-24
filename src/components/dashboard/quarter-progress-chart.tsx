"use client";

import { useId } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { QuarterProgressPoint } from "@/lib/quarter-progress";

type QuarterProgressChartProps = {
  data: QuarterProgressPoint[];
  todayKey?: string | null;
  height?: number;
  compact?: boolean;
  showAxes?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
});

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(value: string) {
  return dateFormatter.format(new Date(value));
}

type TooltipPayloadItem = {
  dataKey: "actualProgress" | "idealProgress";
  value: number;
  payload: QuarterProgressPoint;
};

function ProgressTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) {
    return null;
  }

  const actual = payload.find((item) => item.dataKey === "actualProgress");
  const ideal = payload.find((item) => item.dataKey === "idealProgress");

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-primary">
        {formatDateLabel(label)}
      </p>
      <div className="mt-2 space-y-1 text-sm">
        <p className="font-semibold text-foreground">
          Ist: {formatPercent(actual?.value)}%
        </p>
        <p className="text-muted-foreground">
          Soll: {formatPercent(ideal?.value)}%
        </p>
      </div>
    </div>
  );
}

export function QuarterProgressChart({
  data,
  todayKey,
  height = 280,
  compact = false,
  showAxes = true,
}: QuarterProgressChartProps) {
  const gradientId = useId();

  return (
    <div
      className={compact ? "w-full min-w-0" : "w-full min-w-0"}
      style={compact ? { height: 96, width: "100%" } : { height, width: "100%" }}
      data-testid={compact ? undefined : "quarter-progress-chart"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          {!compact ? (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff0086" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#ff0086" stopOpacity={0.02} />
              </linearGradient>
            </defs>
          ) : null}
          {!compact ? (
            <CartesianGrid vertical={false} stroke="rgba(85, 85, 85, 0.12)" />
          ) : null}
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            axisLine={false}
            tickLine={false}
            tick={showAxes ? { fill: "#6e6e73", fontSize: 12 } : false}
            minTickGap={compact ? 24 : 32}
            hide={!showAxes}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={showAxes ? { fill: "#6e6e73", fontSize: 12 } : false}
            width={showAxes ? 34 : 0}
            hide={!showAxes}
          />
          {!compact ? <Tooltip content={<ProgressTooltip />} /> : null}
          <Line
            type="linear"
            dataKey="idealProgress"
            stroke="rgba(29, 29, 31, 0.35)"
            strokeWidth={compact ? 1.5 : 2}
            dot={false}
            strokeDasharray="6 6"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="actualProgress"
            stroke="#ff0086"
            strokeWidth={compact ? 2 : 3}
            dot={
              compact
                ? false
                : ({ cx, cy, payload }) => {
                    if (!payload?.hasUpdate || payload.actualProgress === null) {
                      return null;
                    }

                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill="#ff0086"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }
            }
            connectNulls={false}
            fill={compact ? undefined : `url(#${gradientId})`}
            isAnimationActive={false}
          />
          {todayKey ? (
            <ReferenceLine
              x={todayKey}
              stroke="rgba(17, 24, 39, 0.35)"
              strokeDasharray="3 4"
              label={
                compact
                  ? undefined
                  : {
                      value: "Heute",
                      position: "insideTopRight",
                      fill: "#6e6e73",
                      fontSize: 12,
                    }
              }
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
