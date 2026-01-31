import { useMemo } from "react";

import { calculateProgress } from "@/lib/progress";

type ProgressKeyResult = {
  currentValue: number;
  targetValue: number;
};

export function useObjectiveProgress(keyResults: ProgressKeyResult[]) {
  return useMemo(() => calculateProgress(keyResults), [keyResults]);
}
