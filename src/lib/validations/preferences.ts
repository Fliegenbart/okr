import { z } from "zod";

import { KEY_RESULT_SORT_OPTIONS, OBJECTIVE_SORT_OPTIONS } from "@/lib/sorting";

export const setObjectiveSortPreferenceSchema = z.object({
  sort: z.enum(OBJECTIVE_SORT_OPTIONS),
});

export const setKeyResultSortPreferenceSchema = z.object({
  sort: z.enum(KEY_RESULT_SORT_OPTIONS),
});
