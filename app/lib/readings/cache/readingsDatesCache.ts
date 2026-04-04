import {
  isCompleteHistoricalReadingsDay,
} from "../dateUtils";
import type { ReadingBucketedDatesRow } from "../readings.types";

const STORAGE_PREFIX = "lux:readings:dates:v1:10m:";

const TTL_MS = 10 * 60 * 1000;

type CachedPayload = { rows: ReadingBucketedDatesRow[]; fetchedAt: number };

export function readingsDatesCacheKey(date: string): string {
  return `${STORAGE_PREFIX}${date}`;
}

function parsePayload(raw: string | null): CachedPayload | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CachedPayload;
    if (
      !Array.isArray(v.rows) ||
      typeof v.fetchedAt !== "number" ||
      !v.rows.every(
        (r) =>
          r &&
          typeof r === "object" &&
          typeof (r as ReadingBucketedDatesRow).bucket_start === "string" &&
          typeof (r as ReadingBucketedDatesRow).sensor === "string",
      )
    ) {
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function readReadingsDatesFromCache(
  key: string,
  chartDate: string,
  observerTimezone?: string,
): ReadingBucketedDatesRow[] | null {
  if (typeof window === "undefined") return null;
  const payload = parsePayload(localStorage.getItem(key));
  if (!payload) return null;
  const immutable = isCompleteHistoricalReadingsDay(chartDate, observerTimezone);
  if (!immutable && Date.now() - payload.fetchedAt > TTL_MS) {
    localStorage.removeItem(key);
    return null;
  }
  return payload.rows;
}

export function writeReadingsDatesToCache(
  key: string,
  rows: ReadingBucketedDatesRow[],
): void {
  if (typeof window === "undefined") return;
  const payload: CachedPayload = { rows, fetchedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(payload));
}
