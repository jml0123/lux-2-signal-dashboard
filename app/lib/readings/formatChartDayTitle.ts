/** Human-readable label for the dashboard `YYYY-MM-DD` civil date. */
export function formatChartDayTitle(
  dateStr: string,
  observerTimezone?: string,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: observerTimezone?.trim() ? observerTimezone : "UTC",
  }).format(utcNoon);
}
