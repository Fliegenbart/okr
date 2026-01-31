type ProgressItem = {
  currentValue: number;
  targetValue: number;
};

export function calculateProgress(items: ProgressItem[]) {
  if (!items.length) return 0;

  const ratios = items.map((item) => {
    if (item.targetValue <= 0) return 0;
    return Math.min(item.currentValue / item.targetValue, 1);
  });

  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  return Math.round((total / ratios.length) * 100);
}
