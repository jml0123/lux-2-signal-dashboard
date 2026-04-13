import { getSunTimes } from "sunrise-sunset-js";
import { getUtcDayBounds } from "./dateUtils";

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

/**
 * Human-friendly location label for title area.
 * Uses explicit env label when provided; falls back to raw coordinates.
 */
export function formatObserverLocationLabel(
  coords: ObserverCoords | null,
): string | null {
  if (!coords) return null;
  const configuredLabel = process.env.OBSERVER_LOCATION_LABEL?.trim();
  if (configuredLabel) return configuredLabel;
  return `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
}

function bestAddressLabel(address: Record<string, string | undefined>): string | null {
  const cityLike = address.city ?? address.town ?? address.village ?? address.hamlet;
  const state = address.state;
  if (cityLike && state) return `${cityLike}, ${state}`;
  if (cityLike) return cityLike;
  if (state) return state;
  return null;
}

/**
 * Reverse geocodes observer coordinates to a human label (city/state) when possible.
 * Falls back to configured env label, then raw coordinates.
 */
export async function resolveObserverLocationLabel(
  coords: ObserverCoords | null,
): Promise<string | null> {
  if (!coords) return null;
  const configured = process.env.OBSERVER_LOCATION_LABEL?.trim();
  if (configured) return configured;

  try {
    const lat = coords.lat.toFixed(6);
    const lon = coords.lng.toFixed(6);
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url, {
      headers: {
        // Nominatim asks clients to identify themselves.
        "User-Agent": "lux-2-sound-dashboard/1.0",
      },
      // Revalidate occasionally to avoid repeated lookups.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
    const data = (await res.json()) as {
      address?: Record<string, string | undefined>;
      name?: string;
      display_name?: string;
    };

    const addr = data.address ?? {};
    const label = bestAddressLabel(addr);
    if (label) return label;
    if (data.name?.trim()) return data.name.trim();
    if (data.display_name?.trim()) return data.display_name.split(",")[0]?.trim() ?? null;
  } catch {
    // fall through to numeric fallback below
  }

  return `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
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

/**
 * Returns the observer's UTC offset in fractional hours at `anchorDate` (DST-aware).
 * e.g. America/New_York in summer → -4; in winter → -5.
 * Uses Intl so it works regardless of the Node.js process timezone.
 */
function ianaOffsetHours(ianaTimezone: string, anchorDate: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(anchorDate);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  // hour12:false can return 24 for midnight — normalise to 0.
  const h = get("hour") % 24;
  const localMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    h,
    get("minute"),
    get("second"),
  );
  return (localMs - anchorDate.getTime()) / 3_600_000;
}

/**
 * SPA options for the observer's timezone.
 * Passes a numeric `timezone` offset (not `timezoneId`) because sunrise-sunset-js
 * stores `timezoneId` but never reads it — the calculation always uses `timezone`.
 * Computing the offset via Intl makes this correct on any server timezone (incl. UTC).
 */
function spaOptionsForObserver(anchorDate: Date): { timezone: number } | undefined {
  const tz = getObserverTimezone();
  if (!tz) return undefined;
  return { timezone: ianaOffsetHours(tz, anchorDate) };
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
  const anchor = solarNoonUtcForDateStr(dateStr);
  const times = getSunTimes(
    coords.lat,
    coords.lng,
    anchor,
    spaOptionsForObserver(anchor),
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
  const anchor = solarNoonUtcForDateStr(dateStr);
  const times = getSunTimes(
    coords.lat,
    coords.lng,
    anchor,
    spaOptionsForObserver(anchor),
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
