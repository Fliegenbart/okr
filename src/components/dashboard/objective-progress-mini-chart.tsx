import Link from "next/link";

import { QuarterProgressChart } from "@/components/dashboard/quarter-progress-chart";
import { Card, CardContent } from "@/components/ui/card";
import type { ObjectiveQuarterProgressSeries } from "@/lib/quarter-progress";

type ObjectiveProgressMiniChartProps = {
  objective: ObjectiveQuarterProgressSeries;
  href: string;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

export function ObjectiveProgressMiniChart({
  objective,
  href,
}: ObjectiveProgressMiniChartProps) {
  return (
    <Card
      className="rounded-2xl border-border shadow-sm"
      data-testid={`objective-progress-${objective.id}`}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {objective.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {objective.lastUpdateAt
                ? `Letztes Update: ${dateFormatter.format(
                    new Date(objective.lastUpdateAt)
                  )}`
                : "Noch keine Updates"}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {objective.currentProgress}%
          </span>
        </div>

        <Link
          href={href}
          className="block min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <QuarterProgressChart
            data={objective.points}
            compact={true}
            showAxes={false}
          />
          <p className="mt-2 text-xs font-medium text-primary">
            Objective öffnen
          </p>
        </Link>
      </CardContent>
    </Card>
  );
}
