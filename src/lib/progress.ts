import {
  calculateKeyResultProgress,
  type KeyResultProgressInput,
} from "@/lib/key-results";

export function formatProgressPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function calculateProgress(items: ReadonlyArray<KeyResultProgressInput>) {
  if (!items.length) return 0;

  const ratios = items.map((item) => calculateKeyResultProgress(item) / 100);

  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  return Math.round((total / ratios.length) * 100);
}
