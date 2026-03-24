export function buildReadingsQueryPath(nextDate: string, nextSensor: string) {
  const params = new URLSearchParams();
  params.set("date", nextDate);
  if (nextSensor.trim()) params.set("sensor", nextSensor);
  return `/?${params.toString()}`;
}
