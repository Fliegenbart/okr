"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

type ChartPoint = {
  date: string;
  value: number;
};

type KeyResultChartProps = {
  data: ChartPoint[];
  targetValue: number;
  unit?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
});

function formatDate(value: string) {
  const date = new Date(value);
  return dateFormatter.format(date);
}

type TooltipPayload = {
  value: number;
  payload: ChartPoint;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const formattedDate = label ? formatDate(label) : "";

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-2 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-primary">
        {formattedDate}
      </p>
      <p className="text-sm font-semibold text-foreground">
        {item.value}
      </p>
    </div>
  );
}

export function KeyResultChart({
  data,
  targetValue,
  unit,
}: KeyResultChartProps) {
  const gradientId = useId();
  const targetLabel = `Ziel: ${targetValue}${unit ? ` ${unit}` : ""}`;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff0086" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#ff0086" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#555555", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#555555", fontSize: 12 }}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={targetValue}
            stroke="#52c1f3"
            strokeDasharray="4 4"
            label={{
              value: targetLabel,
              position: "top",
              fill: "#52c1f3",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#ff0086"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
