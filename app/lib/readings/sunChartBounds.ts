import { getSunTimes } from "sunrise-sunset-js";
import { getUtcDayBounds } from "./dayBounds";

/**
 * Padding outside civil twilight: 30m before civil dawn, 30m after civil dusk.
 * (Civil twilight = sun −6° to horizon; matches common “dawn/dusk” for sensors.)
 */
const EDGE_PAD_MS = 30 * 60 * 1000;

export type ObserverCoords = { lat: number; lng: number };

/**
 * OBSERVER_LAT / OBSERVER_LNG (decimal degrees) at the sensor site.
 * Optional OBSERVER_TIMEZONE (IANA) aligns the selected YYYY-MM-DD with local civil date.
 */
export function parseObserverCoords(): ObserverCoords | null {
  const lat = Number(process.env.OBSERVER_LAT);
  const lng = Number(process.env.OBSERVER_LNG);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function getObserverTimezone(): string | undefined {
  const tz = process.env.OBSERVER_TIMEZONE?.trim();
  return tz || undefined;
}

/** Noon UTC anchor for the observer’s calendar `YYYY-MM-DD` (same as SPA date input). */
export function solarNoonUtcForDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function spaOptionsForObserver(): { timezoneId: string } | undefined {
  const tz = getObserverTimezone();
  return tz ? { timezoneId: tz } : undefined;
}

/** ISO times for sun events at `OBSERVER_LAT` / `OBSERVER_LNG` (SPA / NREL). */
export type ChartSunMarkersIso = {
  civilDawn: string;
  sunrise: string;
  /** Solar transit: sun at highest point (astronomical midday). */
  solarNoon: string;
  sunset: string;
  civilDusk: string;
};

/**
 * Coordinate-based sun events for chart annotations (same `getSunTimes` call as bounds).
 */
export function getChartSunMarkersIso(
  dateStr: string,
  coords: ObserverCoords,
): ChartSunMarkersIso | null {
  const times = getSunTimes(
    coords.lat,
    coords.lng,
    solarNoonUtcForDateStr(dateStr),
    spaOptionsForObserver(),
  );
  const tw = times.twilight;
  if (
    !tw?.civilDawn ||
    !tw?.civilDusk ||
    !times.sunrise ||
    !times.sunset ||
    !times.solarNoon
  ) {
    return null;
  }
  return {
    civilDawn: tw.civilDawn.toISOString(),
    sunrise: times.sunrise.toISOString(),
    solarNoon: times.solarNoon.toISOString(),
    sunset: times.sunset.toISOString(),
    civilDusk: tw.civilDusk.toISOString(),
  };
}

/**
 * X-axis domain: 30m before **civil dawn** → 30m after **civil dusk** at the observer.
 * Same lat/lng as env. If twilight cannot be resolved (e.g. polar day/night), falls back
 * to inclusive UTC calendar day on the chart.
 */
export function getDawnDuskChartBounds(
  dateStr: string,
  coords: ObserverCoords,
): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const times = getSunTimes(
    coords.lat,
    coords.lng,
    solarNoonUtcForDateStr(dateStr),
    spaOptionsForObserver(),
  );
  const dawn = times.twilight?.civilDawn;
  const dusk = times.twilight?.civilDusk;

  if (!dawn || !dusk) {
    const { start } = getUtcDayBounds(dateStr);
    return {
      start,
      end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
    };
  }

  return {
    start: new Date(dawn.getTime() - EDGE_PAD_MS),
    end: new Date(dusk.getTime() + EDGE_PAD_MS),
  };
}

/**
 * Half-open fetch window [start, end): union of the UTC calendar day and the chart window
 * so edge readings are included (chart end is inclusive, then +1ms for exclusivity).
 */
export function getReadingsQueryBounds(
  dateStr: string,
  chartBounds: { start: Date; end: Date },
): { start: Date; end: Date } {
  const utc = getUtcDayBounds(dateStr);
  const chartEndExclusive = new Date(chartBounds.end.getTime() + 1);
  return {
    start: new Date(
      Math.min(utc.start.getTime(), chartBounds.start.getTime()),
    ),
    end: new Date(
      Math.max(utc.end.getTime(), chartEndExclusive.getTime()),
    ),
  };
}
