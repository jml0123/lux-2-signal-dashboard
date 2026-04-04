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

/** Add signed whole days to a UTC `YYYY-MM-DD` string. */
export function utcDateAddDays(isoDate: string, deltaDays: number): string {
  const { start } = getUtcDayBounds(isoDate);
  const t = start.getTime() + deltaDays * 86_400_000;
  return formatUtcDateParam(new Date(t));
}

/**
 * UTC calendar dates from `oldest` through `newest` inclusive, ascending.
 * Assumes valid `YYYY-MM-DD` strings with `oldest <= newest`.
 */
export function utcDateRangeInclusive(oldest: string, newest: string): string[] {
  const out: string[] = [];
  let d = oldest;
  while (d <= newest) {
    out.push(d);
    d = utcDateAddDays(d, 1);
  }
  return out;
}

/**
 * Rolling window of `count` UTC calendar days ending at `anchor` (inclusive),
 * oldest → newest. Clamps each day to `>= minDate` (drop older).
 */
export function utcDatesRollingEndingAtClamped(
  anchor: string,
  count: number,
  minDate: string,
): string[] {
  if (count <= 0) return [];
  const raw: string[] = [];
  for (let k = count - 1; k >= 0; k--) {
    raw.push(utcDateAddDays(anchor, -k));
  }
  return raw.filter((d) => d >= minDate);
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
  const candidate = isValidUtcDateParam(dateRaw) ? dateRaw : defaultDashboardDateString();
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

/** `true` when every date is strictly before “today” (observer TZ or UTC). */
export function areReadingsCalendarDatesAllBeforeToday(
  dates: string[],
  observerTimezone?: string,
): boolean {
  if (dates.length === 0) return false;
  const today = readingsCalendarDateForInstant(new Date(), observerTimezone);
  return dates.every((d) => d < today);
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

/** UTC midnights for each calendar day in a strip: `daySpan` days from `domainStartIso`. */
export function utcDayMidnightSequence(
  domainStartIso: string,
  daySpan: number,
): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < daySpan; i++) {
    out.push(getUtcDayBounds(utcDateAddDays(domainStartIso, i)).start);
  }
  return out;
}

function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * UTC instant when `timeZone` wall time is `hour`:`minute` on civil date `isoDate`
 * (`YYYY-MM-DD` in that zone).
 */
export function utcInstantAtLocalWallTime(
  isoDate: string,
  timeZone: string,
  hour: number,
  minute: number,
): Date {
  const [y0, mo0, d0] = isoDate.split("-").map(Number);
  if (!y0 || !mo0 || !d0) {
    throw new Error(`Invalid date: ${isoDate}`);
  }

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  function wall(ms: number) {
    const parts = fmt.formatToParts(new Date(ms));
    const n = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "-1", 10);
    return {
      y: n("year"),
      m: n("month"),
      d: n("day"),
      h: n("hour"),
      mi: n("minute"),
    };
  }

  function cmp(
    a: { y: number; m: number; d: number; h: number; mi: number },
    b: { y: number; m: number; d: number; h: number; mi: number },
  ) {
    if (a.y !== b.y) return a.y - b.y;
    if (a.m !== b.m) return a.m - b.m;
    if (a.d !== b.d) return a.d - b.d;
    return a.h * 60 + a.mi - (b.h * 60 + b.mi);
  }

  const target = { y: y0, m: mo0, d: d0, h: hour, mi: minute };
  let lo = Date.UTC(y0, mo0 - 1, d0 - 1, 0, 0, 0, 0);
  let hi = Date.UTC(y0, mo0 - 1, d0 + 2, 0, 0, 0, 0);

  for (let i = 0; i < 64; i++) {
    if (lo > hi) break;
    const mid = Math.floor((lo + hi) / 2);
    const w = wall(mid);
    const c = cmp(w, target);
    if (c === 0) return new Date(mid);
    if (c < 0) lo = mid + 1;
    else hi = mid - 1;
  }

  return new Date(Date.UTC(y0, mo0 - 1, d0, 12, 0, 0, 0));
}

/**
 * UTC noon for each calendar day in a strip — use for x-axis labels so weekday text
 * sits under the center of that day’s data (midnight ticks sit left of the daily shape).
 */
export function utcDayNoonSequence(
  domainStartIso: string,
  daySpan: number,
): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < daySpan; i++) {
    const day = utcDateAddDays(domainStartIso, i);
    const [y, m, d] = day.split("-").map(Number);
    if (!y || !m || !d) continue;
    out.push(new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)));
  }
  return out;
}

/**
 * X-axis tick instants for ridgelines: **local noon** on each strip date in
 * `observerTimezone` when valid, otherwise UTC noon. Strip dates remain UTC calendar
 * days; this only picks the tick time inside each day (aligns solar shape for the observer).
 */
export function ridgelineAxisNoonInstants(
  domainStartIso: string,
  daySpan: number,
  observerTimezone?: string,
): Date[] {
  const tz = observerTimezone?.trim();
  if (!tz || !isValidIanaTimeZone(tz)) {
    return utcDayNoonSequence(domainStartIso, daySpan);
  }
  const out: Date[] = [];
  for (let i = 0; i < daySpan; i++) {
    const day = utcDateAddDays(domainStartIso, i);
    out.push(utcInstantAtLocalWallTime(day, tz, 12, 0));
  }
  return out;
}

/** Weekday only, UTC (e.g. `Mon`, `Tue`). */
export function formatUtcWeekdayShort(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(value);
}

/** Weekday for ridgeline ticks (observer zone when set, else UTC). */
export function formatRidgelineAxisWeekday(
  value: Date,
  observerTimezone?: string,
): string {
  const tz = observerTimezone?.trim();
  const zone = tz && isValidIanaTimeZone(tz) ? tz : "UTC";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: zone,
  }).format(value);
}

