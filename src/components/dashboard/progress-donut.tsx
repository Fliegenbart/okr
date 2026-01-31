import { cn } from "@/lib/utils";

type ProgressDonutProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showValue?: boolean;
  showLabel?: boolean;
  valueClassName?: string;
  progressClassName?: string;
  trackClassName?: string;
  className?: string;
};

export function ProgressDonut({
  value,
  size = 80,
  strokeWidth = 6,
  label = "Gesamt",
  showValue = true,
  showLabel = true,
  valueClassName,
  progressClassName = "text-primary",
  trackClassName = "text-muted/60",
  className,
}: ProgressDonutProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
      aria-label={`Fortschritt ${clamped}%`}
    >
      <svg
        className="h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className={trackClassName}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={progressClassName}
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
      {showValue || showLabel ? (
        <div className="absolute flex flex-col items-center">
          {showValue ? (
            <span
              className={cn("text-lg font-semibold text-foreground", valueClassName)}
            >
              {clamped}%
            </span>
          ) : null}
          {showLabel ? (
            <span className="text-[10px] font-medium text-muted-foreground">
              {label}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
