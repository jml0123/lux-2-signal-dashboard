import { READINGS_DATA_EPOCH_DATE } from "@/app/lib/readings/readings.constants";

/** IANA zone furthest ahead (UTC+14); calendar date here is the latest civil date on Earth. */
const LATEST_DATE_ANYWHERE_TZ = "Pacific/Kiritimati";

export type ChartDayTitleParts = {
  /** e.g. `Mar. 23 2026` */
  dateLine: string;
  /** e.g. `Monday` */
  weekdayLine: string;
};

/** Calendar day bounds in UTC for a `YYYY-MM-DD` string (exclusive end). */
export function getUtcDayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (
    !y ||
    !m ||
    !d ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return { start, end };
}

/** Inclusive end-of-day UTC for chart x-domain when not using dawn/dusk bounds. */
export function getUtcDayChartInclusiveBounds(dateStr: string): {
  start: Date;
  end: Date;
} {
  const { start } = getUtcDayBounds(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  return {
    start,
    end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

export function formatUtcDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcTodayDateString(): string {
  return formatUtcDateParam(new Date());
}

/**
 * Latest `YYYY-MM-DD` that has already begun somewhere on Earth (UTC+14 / Line Islands).
 * Use as the inclusive max selectable chart day so users cannot pick a calendar day that
 * does not exist yet in any timezone.
 */
export function latestCalendarDateAnywhere(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LATEST_DATE_ANYWHERE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Local `Date` at midnight for a `YYYY-MM-DD` param (matches date picker / `input type=date`). */
export function localCalendarDateFromIsoParam(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Valid chart day clamped to [READINGS_DATA_EPOCH_DATE, latestCalendarDateAnywhere].
 * Invalid or missing `dateRaw` falls back to the default dashboard day, then clamped.
 */
export function clampReadingsDateParam(dateRaw: string): string {
  const min = READINGS_DATA_EPOCH_DATE;
  const max = latestCalendarDateAnywhere();
  let candidate = isValidUtcDateParam(dateRaw) ? dateRaw : defaultDashboardDateString();
  if (candidate < min) return min;
  if (candidate > max) return max;
  return candidate;
}

/**
 * `YYYY-MM-DD` for `instant` in `observerTimezone`, or UTC calendar date when unset/invalid.
 * Matches how the date picker and `defaultDashboardDateString` interpret “days”.
 */
export function readingsCalendarDateForInstant(
  instant: Date,
  observerTimezone?: string,
): string {
  const tz = observerTimezone?.trim();
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(instant);
    } catch {
      // invalid TZ id — fall back to UTC
    }
  }
  return formatUtcDateParam(instant);
}

/** Chart day is strictly before “today” in observer TZ (or UTC) — safe to treat as a full, closed day. */
export function isCompleteHistoricalReadingsDay(
  chartDateStr: string,
  observerTimezone?: string,
): boolean {
  const today = readingsCalendarDateForInstant(new Date(), observerTimezone);
  return chartDateStr < today;
}

/**
 * True when the query window ends on a calendar day before today (observer TZ or UTC).
 * Used for long-lived HTTP caching of bucketed readings.
 */
export function isReadingsQueryRangeFullyBeforeToday(
  rangeEnd: Date,
  observerTimezone?: string,
): boolean {
  const endDay = readingsCalendarDateForInstant(rangeEnd, observerTimezone);
  const today = readingsCalendarDateForInstant(new Date(), observerTimezone);
  return endDay < today;
}

/** "Today" in OBSERVER_TIMEZONE when set; otherwise UTC calendar date. */
export function defaultDashboardDateString(): string {
  return readingsCalendarDateForInstant(
    new Date(),
    process.env.OBSERVER_TIMEZONE,
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidUtcDateParam(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  try {
    getUtcDayBounds(s);
    return true;
  } catch {
    return false;
  }
}

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
