export type ChartDayTitleParts = {
  /** e.g. `Mar. 23 2026` */
  dateLine: string;
  /** e.g. `Monday` */
  weekdayLine: string;
};

/** Date + weekday strings for the chart masthead (often one line, two sizes). */
export function formatChartDayTitleParts(
  dateStr: string,
  observerTimezone?: string,
): ChartDayTitleParts {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) {
    return { dateLine: dateStr, weekdayLine: "" };
  }

  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const tz = observerTimezone?.trim() ? observerTimezone : "UTC";

  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  });

  let weekday = "";
  let month = "";
  let day = "";
  let year = "";
  for (const p of fmt.formatToParts(utcNoon)) {
    if (p.type === "weekday") weekday = p.value;
    else if (p.type === "month") month = p.value;
    else if (p.type === "day") day = p.value;
    else if (p.type === "year") year = p.value;
  }

  const monthWithDot = month.endsWith(".") ? month : `${month}.`;
  return {
    dateLine: `${monthWithDot} ${day} ${year}`,
    weekdayLine: weekday,
  };
}
