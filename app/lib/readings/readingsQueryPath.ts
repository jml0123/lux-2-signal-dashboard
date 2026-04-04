/** Day vs multi-day tab (UI); routes are `/` and `/multiday`. */
export type ReadingsScopeTab = "day" | "multi";

export function buildReadingsQueryPath(date: string, sensor: string) {
  const params = new URLSearchParams();
  params.set("date", date);
  if (sensor.trim()) params.set("sensor", sensor.trim());
  return `/?${params.toString()}`;
}

/**
 * `endWeek` is `YYYY-MM-wkK`. Optional `dayDate` is the day-view `date` to restore when
 * switching back from multi-day (same param name as on `/` for simplicity).
 */
export function buildMultidayQueryPath(
  sensor: string,
  endWeek?: string,
  dayDate?: string,
) {
  const params = new URLSearchParams();
  if (endWeek?.trim()) params.set("endWeek", endWeek.trim());
  if (sensor.trim()) params.set("sensor", sensor.trim());
  if (dayDate?.trim()) params.set("date", dayDate.trim());
  const q = params.toString();
  return q ? `/multiday?${q}` : "/multiday";
}
