"use client";

import { Children, type ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type CollapsibleGridProps = {
  children: ReactNode;
  className: string;
  initialVisibleCount?: number;
  itemLabel: string;
};

export function CollapsibleGrid({
  children,
  className,
  initialVisibleCount = 10,
  itemLabel,
}: CollapsibleGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const items = useMemo(() => Children.toArray(children).filter(Boolean), [children]);

  const hasOverflow = items.length > initialVisibleCount;
  const visibleItems = hasOverflow && !isExpanded ? items.slice(0, initialVisibleCount) : items;

  return (
    <div className="space-y-4">
      <div className={className}>{visibleItems}</div>
      {hasOverflow ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? `Weniger ${itemLabel} anzeigen` : `Weitere ${itemLabel} anzeigen`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
