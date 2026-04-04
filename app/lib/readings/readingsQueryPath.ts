/** Day vs multi-day tab (UI); routes are `/` and `/multiday`. */
export type ReadingsScopeTab = "day" | "multi";

export function buildReadingsQueryPath(date: string, sensor: string) {
  const params = new URLSearchParams();
  params.set("date", date);
  if (sensor.trim()) params.set("sensor", sensor.trim());
  return `/?${params.toString()}`;
}

/** `endWeek` is `YYYY-MM-wkK` (same token shape as month-week window). */
export function buildMultidayQueryPath(sensor: string, endWeek?: string) {
  const params = new URLSearchParams();
  if (endWeek?.trim()) params.set("endWeek", endWeek.trim());
  if (sensor.trim()) params.set("sensor", sensor.trim());
  const q = params.toString();
  return q ? `/multiday?${q}` : "/multiday";
}
