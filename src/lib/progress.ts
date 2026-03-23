import { calculateKeyResultProgress, type KeyResultLike } from "@/lib/key-results";

type ProgressItem = KeyResultLike;

export function calculateProgress(items: ProgressItem[]) {
  if (!items.length) return 0;

  const ratios = items.map((item) => calculateKeyResultProgress(item) / 100);

  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  return Math.round((total / ratios.length) * 100);
}
