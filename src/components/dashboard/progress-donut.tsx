import { cn } from "@/lib/utils";

type ProgressDonutProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
};

export function ProgressDonut({
  value,
  size = 92,
  strokeWidth = 10,
  label = "Gesamt",
  showLabel = true,
  className,
}: ProgressDonutProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label={`Fortschritt ${clamped}%`}
    >
      <svg
        className="h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="text-muted-foreground/20"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-primary"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-semibold text-foreground">
          {clamped}%
        </span>
        {showLabel ? (
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
