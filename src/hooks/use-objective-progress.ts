import type { KeyResultDirection, KeyResultType } from "@/lib/key-results";
import { useMemo } from "react";

import { calculateProgress } from "@/lib/progress";

type ProgressKeyResult = {
  currentValue: number;
  targetValue: number;
  startValue?: number;
  type?: KeyResultType;
  direction?: KeyResultDirection;
  redThreshold?: number | null;
  yellowThreshold?: number | null;
  greenThreshold?: number | null;
};

export function useObjectiveProgress(keyResults: ProgressKeyResult[]) {
  return useMemo(() => calculateProgress(keyResults), [keyResults]);
}
