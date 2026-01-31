export function getQuarterInfo(date = new Date()) {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;

  const startsAt = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const endsAt = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

  return {
    title: `Q${quarter} ${year}`,
    startsAt,
    endsAt,
  };
}
