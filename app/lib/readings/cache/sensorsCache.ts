const STORAGE_KEY = "lux:sensors:v1";
const TTL_MS = 24 * 60 * 60 * 1000;

type CachedPayload = { sensors: string[]; fetchedAt: number };

function parsePayload(raw: string | null): CachedPayload | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CachedPayload;
    if (
      !Array.isArray(v.sensors) ||
      !v.sensors.every((s) => typeof s === "string") ||
      typeof v.fetchedAt !== "number"
    ) {
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function readSensorsFromCache(): string[] | null {
  if (typeof window === "undefined") return null;
  const payload = parsePayload(localStorage.getItem(STORAGE_KEY));
  if (!payload) return null;
  if (Date.now() - payload.fetchedAt > TTL_MS) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return payload.sensors;
}

export function writeSensorsToCache(sensors: string[]): void {
  if (typeof window === "undefined") return;
  const payload: CachedPayload = { sensors, fetchedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
