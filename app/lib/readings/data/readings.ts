import {
  getReadingsBucketed as fetchReadingsBucketed,
  getReadingsForCalendarDay as fetchReadingsForCalendarDay,
  getReadingsForTimeRange as fetchReadingsForTimeRange,
  getSensorNamesSupabase,
} from "./readings.repo";
import type {
  LuxChartPoint,
  LuxDualPoint,
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
 * When "All sensors" and exactly two sensors appear in RPC rows, build aligned
 * points for dual-series viz. Otherwise null (use merged single series).
 */
export function bucketedRowsToDualLuxPoints(
  rows: ReadingBucketedRow[],
): { sensorA: string; sensorB: string; points: LuxDualPoint[] } | null {
  if (rows.length === 0) return null;

  const bySensor = new Map<string, LuxChartPoint[]>();
  for (const r of rows) {
    const t =
      typeof r.bucket_start === "string"
        ? r.bucket_start
        : String(r.bucket_start);
    const lux = Number(r.value_avg);
    if (!Number.isFinite(lux)) continue;
    if (!bySensor.has(r.sensor)) bySensor.set(r.sensor, []);
    bySensor.get(r.sensor)!.push({ time: t, lux });
  }

  const sensors = [...bySensor.keys()].sort();
  if (sensors.length !== 2) return null;

  const [sensorA, sensorB] = sensors;
  const seriesA = bySensor.get(sensorA)!;
  const bByTime = new Map(
    bySensor.get(sensorB)!.map((p) => [p.time, p.lux] as const),
  );

  const points: LuxDualPoint[] = [];
  for (const p of seriesA) {
    const lb = bByTime.get(p.time);
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

export async function getAvailableSensors(): Promise<string[]> {
  return getSensorNamesSupabase();
}
