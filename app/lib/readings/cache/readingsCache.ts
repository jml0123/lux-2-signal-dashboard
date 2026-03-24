import type { ReadingBucketedRow } from "../readings.types";

const STORAGE_PREFIX = "lux:readings:v1:";
const TTL_MS = 10 * 60 * 1000;

type CachedPayload = { rows: ReadingBucketedRow[]; fetchedAt: number };

export function readingsCacheKey(
  date: string,
  sensor: string,
  queryStartIso: string,
  queryEndIso: string,
): string {
  const sensorKey = sensor.trim() ? sensor.trim() : "all";
  return `${STORAGE_PREFIX}${date}:${sensorKey}:${queryStartIso}:${queryEndIso}`;
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
          typeof (r as ReadingBucketedRow).bucket_start === "string" &&
          typeof (r as ReadingBucketedRow).sensor === "string",
      )
    ) {
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function readReadingsFromCache(
  key: string,
): ReadingBucketedRow[] | null {
  if (typeof window === "undefined") return null;
  const payload = parsePayload(localStorage.getItem(key));
  if (!payload) return null;
  if (Date.now() - payload.fetchedAt > TTL_MS) {
    localStorage.removeItem(key);
    return null;
  }
  return payload.rows;
}

export function writeReadingsToCache(
  key: string,
  rows: ReadingBucketedRow[],
): void {
  if (typeof window === "undefined") return;
  const payload: CachedPayload = { rows, fetchedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(payload));
}
