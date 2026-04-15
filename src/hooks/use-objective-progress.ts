import type { KeyResultProgressInput } from "@/lib/key-results";
import { useMemo } from "react";

import { calculateProgress } from "@/lib/progress";

export function useObjectiveProgress(keyResults: ReadonlyArray<KeyResultProgressInput>) {
  return useMemo(() => calculateProgress(keyResults), [keyResults]);
}
