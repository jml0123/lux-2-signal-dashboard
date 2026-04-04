import {
  getReadingsBucketed as fetchReadingsBucketed,
  getReadingsBucketedDates as fetchReadingsBucketedDates,
  getReadingsForCalendarDay as fetchReadingsForCalendarDay,
  getReadingsForTimeRange as fetchReadingsForTimeRange,
  getSensorNamesSupabase,
} from "./readings.repo";
import type {
  LuxChartPoint,
  LuxDualPoint,
  ReadingBucketedDatesRow,
  ReadingBucketedRow,
  ReadingDbDto,
  ReadingsBucketedParams,
  ReadingsDayParams,
  ReadingsRangeParams,
} from "../readings.types";

export async function getReadingsBucketed(
  params: ReadingsBucketedParams,
): Promise<ReadingBucketedRow[]> {
  return fetchReadingsBucketed(params);
}

export async function getReadingsBucketedDates(
  dates: string[],
): Promise<ReadingBucketedDatesRow[]> {
  return fetchReadingsBucketedDates(dates);
}

function utcDayFromBucketStart(bucketStart: string): string {
  return bucketStart.slice(0, 10);
}

/** Group `readings_bucketed_dates` rows by `day_date` for cache writes. */
export function bucketedDatesRowsByDay(
  rows: ReadingBucketedDatesRow[],
): Map<string, ReadingBucketedDatesRow[]> {
  const m = new Map<string, ReadingBucketedDatesRow[]>();
  for (const r of rows) {
    const rawDay = (r as { day_date?: unknown }).day_date;
    const day =
      typeof rawDay === "string" && rawDay.length >= 10
        ? rawDay.slice(0, 10)
        : utcDayFromBucketStart(
            typeof r.bucket_start === "string"
              ? r.bucket_start
              : String(r.bucket_start),
          );
    if (!m.has(day)) m.set(day, []);
    m.get(day)!.push(r);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => {
      const ta =
        typeof a.bucket_start === "string"
          ? a.bucket_start
          : String(a.bucket_start);
      const tb =
        typeof b.bucket_start === "string"
          ? b.bucket_start
          : String(b.bucket_start);
      return ta.localeCompare(tb);
    });
  }
  return m;
}

export async function getReadingsForTimeRange(
  params: ReadingsRangeParams,
): Promise<ReadingDbDto[]> {
  return fetchReadingsForTimeRange(params);
}

export async function getReadingsForCalendarDay(
  params: ReadingsDayParams,
): Promise<ReadingDbDto[]> {
  return fetchReadingsForCalendarDay(params);
}

export function readingsToLuxChartPoints(
  readings: ReadingDbDto[],
): LuxChartPoint[] {
  return readings.map((r) => ({ time: r.timestamp, lux: r.value }));
}

/**
 * Canonical ISO timestamp for a bucket so SE/NW joins and merges survive Postgres/JSON
 * formatting differences (`Z` vs `+00:00`, fractional seconds, etc.).
 */
export function normalizeReadingBucketStart(raw: string | unknown): string {
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  const ms = new Date(s).getTime();
  if (!Number.isFinite(ms)) return s;
  return new Date(ms).toISOString();
}

/**
 * Collapse `readings_*_bucketed` rows that share `bucket_start` + `sensor` but differ
 * by `location` (weighted `value_avg`, summed `sample_count`, min/max extrema).
 */
export function mergeBucketedRowsByBucketSensor(
  rows: ReadingBucketedRow[],
): ReadingBucketedRow[] {
  type Acc = {
    sum: number;
    weight: number;
    value_min: number;
    value_max: number;
    proto: ReadingBucketedRow;
    bucketNorm: string;
  };
  const m = new Map<string, Acc>();

  for (const r of rows) {
    const tNorm = normalizeReadingBucketStart(r.bucket_start);
    const k = `${tNorm}\0${r.sensor}`;
    const lux = Number(r.value_avg);
    if (!Number.isFinite(lux)) continue;
    const w = Math.max(0, Number(r.sample_count) || 0) || 1;
    const vmin = Number(r.value_min);
    const vmax = Number(r.value_max);
    const prev = m.get(k);
    if (!prev) {
      m.set(k, {
        sum: lux * w,
        weight: w,
        value_min: Number.isFinite(vmin) ? vmin : lux,
        value_max: Number.isFinite(vmax) ? vmax : lux,
        proto: r,
        bucketNorm: tNorm,
      });
    } else {
      prev.sum += lux * w;
      prev.weight += w;
      if (Number.isFinite(vmin)) {
        prev.value_min = Math.min(prev.value_min, vmin);
      }
      if (Number.isFinite(vmax)) {
        prev.value_max = Math.max(prev.value_max, vmax);
      }
    }
  }

  return [...m.values()]
    .map((acc) => {
      const w = acc.weight;
      const proto = acc.proto;
      return {
        ...proto,
        bucket_start: acc.bucketNorm,
        value_avg: w > 0 ? acc.sum / w : 0,
        value_min: acc.value_min,
        value_max: acc.value_max,
        sample_count: w,
      } satisfies ReadingBucketedRow;
    })
    .sort((a, b) => {
      const ta =
        typeof a.bucket_start === "string"
          ? a.bucket_start
          : String(a.bucket_start);
      const tb =
        typeof b.bucket_start === "string"
          ? b.bucket_start
          : String(b.bucket_start);
      const c = ta.localeCompare(tb);
      return c !== 0 ? c : a.sensor.localeCompare(b.sensor);
    });
}

/** Canonical names for the two window sensors (case-insensitive match on RPC strings). */
const RIDGE_DUAL_SENSOR_SE = "dk-southeast";
const RIDGE_DUAL_SENSOR_NW = "dk-northwest";

function normSensorKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Pick the two series for dual charts: either exactly two sensors after merge, or the
 * two known window sensors when more names appear in the payload.
 */
function resolveRidgeDualSensorPair(sensorKeys: string[]): [string, string] | null {
  const sorted = [...sensorKeys].sort((a, b) => a.localeCompare(b));
  if (sorted.length === 2) {
    return [sorted[0]!, sorted[1]!];
  }
  const canonSe = sorted.find((k) => normSensorKey(k) === RIDGE_DUAL_SENSOR_SE);
  const canonNw = sorted.find((k) => normSensorKey(k) === RIDGE_DUAL_SENSOR_NW);
  if (!canonSe || !canonNw) return null;
  return [canonSe, canonNw].sort((a, b) => a.localeCompare(b)) as [
    string,
    string,
  ];
}

/**
 * When "All sensors" and exactly two logical sensors (after per-location merge),
 * build aligned points for dual-series viz. Otherwise null (use merged single series).
 */
export function bucketedRowsToDualLuxPoints(
  rows: ReadingBucketedRow[],
): { sensorA: string; sensorB: string; points: LuxDualPoint[] } | null {
  if (rows.length === 0) return null;

  const merged = mergeBucketedRowsByBucketSensor(rows);
  const uniqueSensors = [...new Set(merged.map((r) => r.sensor))];
  const pair = resolveRidgeDualSensorPair(uniqueSensors);
  if (!pair) return null;

  const [sensorA, sensorB] = pair;

  const bySensor = new Map<string, LuxChartPoint[]>();
  for (const r of merged) {
    if (r.sensor !== sensorA && r.sensor !== sensorB) continue;
    const t = normalizeReadingBucketStart(r.bucket_start);
    const lux = Number(r.value_avg);
    if (!Number.isFinite(lux)) continue;
    if (!bySensor.has(r.sensor)) bySensor.set(r.sensor, []);
    bySensor.get(r.sensor)!.push({ time: t, lux });
  }

  const seriesA = bySensor.get(sensorA)!;
  const bByTimeMs = new Map(
    bySensor
      .get(sensorB)!
      .map((p) => [new Date(p.time).getTime(), p.lux] as const),
  );

  const points: LuxDualPoint[] = [];
  for (const p of seriesA) {
    const ms = new Date(p.time).getTime();
    if (!Number.isFinite(ms)) continue;
    const lb = bByTimeMs.get(ms);
    if (lb === undefined || !Number.isFinite(lb)) continue;
    points.push({
      time: p.time,
      luxA: p.lux,
      luxB: lb,
      sensorA,
      sensorB,
    });
  }

  if (points.length < 2) return null;
  return { sensorA, sensorB, points };
}

/** One timestamp with SE lux (drawn first / behind) and NW lux (on top). */
export type LuxRidgeSeNwPoint = {
  time: string;
  luxSe: number;
  luxNw: number;
};

/**
 * Maps dual points so **dk-southeast** is `luxSe` and **dk-northwest** is `luxNw`.
 * In the ridgeline, SE is drawn first (back / higher) and NW second with a downward
 * offset (front / lower). `sensorA` / `luxA` follow alphabetical sensor order.
 */
export function dualLuxPointsSeBottomNwTop(dual: {
  sensorA: string;
  sensorB: string;
  points: LuxDualPoint[];
}): LuxRidgeSeNwPoint[] {
  const { sensorA, sensorB, points } = dual;
  const aIsSe = normSensorKey(sensorA) === RIDGE_DUAL_SENSOR_SE;
  const bIsSe = normSensorKey(sensorB) === RIDGE_DUAL_SENSOR_SE;

  return points.map((p) => {
    if (aIsSe && !bIsSe) {
      return { time: p.time, luxSe: p.luxA, luxNw: p.luxB };
    }
    if (bIsSe && !aIsSe) {
      return { time: p.time, luxSe: p.luxB, luxNw: p.luxA };
    }
    return { time: p.time, luxSe: p.luxA, luxNw: p.luxB };
  });
}

/**
 * RPC rows → single series (one sensor filter, or merged weighted avg when not dual).
 */
export function bucketedRowsToLuxChartPoints(
  rows: ReadingBucketedRow[],
): LuxChartPoint[] {
  if (rows.length === 0) return [];

  const byBucket = new Map<string, { sum: number; weight: number }>();
  for (const r of rows) {
    const t =
      typeof r.bucket_start === "string"
        ? r.bucket_start
        : String(r.bucket_start);
    const w = Math.max(0, Number(r.sample_count) || 0);
    const lux = Number(r.value_avg);
    if (!Number.isFinite(lux)) continue;
    const weight = w > 0 ? w : 1;
    const prev = byBucket.get(t) ?? { sum: 0, weight: 0 };
    prev.sum += lux * weight;
    prev.weight += weight;
    byBucket.set(t, prev);
  }

  return [...byBucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, { sum, weight }]) => ({
      time,
      lux: weight > 0 ? sum / weight : 0,
    }));
}

/** Sorted bucket starts (ms) + lux for ambient scrub: **max** `value_avg` per `bucket_start` across sensors. */
export type LuxTimelineBucket = { timeMs: number; lux: number };

export function buildLuxTimelineForAmbient(rows: ReadingBucketedRow[]): LuxTimelineBucket[] {
  const byTime = new Map<string, number>();
  for (const r of rows) {
    const t =
      typeof r.bucket_start === "string"
        ? r.bucket_start
        : String(r.bucket_start);
    const lux = Number(r.value_avg);
    if (!Number.isFinite(lux)) continue;
    const prev = byTime.get(t);
    byTime.set(t, prev === undefined ? lux : Math.max(prev, lux));
  }
  const out = [...byTime.entries()]
    .map(([time, lux]) => ({ timeMs: new Date(time).getTime(), lux }))
    .filter((b) => Number.isFinite(b.timeMs));
  out.sort((a, b) => a.timeMs - b.timeMs);
  return out;
}

/**
 * Step series: lux from the latest bucket with `timeMs <= t` (holds until the next bucket).
 * Returns null before the first bucket or when the timeline is empty.
 */
export function luxAtTimeMsFromTimeline(
  timeline: LuxTimelineBucket[],
  timeMs: number,
): number | null {
  if (timeline.length === 0) return null;
  let lo = 0;
  let hi = timeline.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = timeline[mid]!.timeMs;
    if (t <= timeMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0) return null;
  return timeline[ans]!.lux;
}

export async function getAvailableSensors(): Promise<string[]> {
  return getSensorNamesSupabase();
}
