import {
  AMBIENT_LUX_SCRUB_MAX_STOP_INDEX,
  AMBIENT_LUX_SCRUB_PALETTE_CAP_LUX,
} from "@/app/lib/readings/readings.constants";
import type { ChartSunMarkersIso } from "@/app/lib/readings/sunChartBounds";
import { AMBIENT_LIGHT_COLORS } from "@/app/lib/theme/dashboardTheme";

export { AMBIENT_LIGHT_COLORS };

/** Half-width in “stop index” space for vertical gradient (top = s − spread, bottom = s + spread). */
export const AMBIENT_VERTICAL_STOP_SPREAD = 0.55;

export type AmbientTimeKnot = { t: number; stop: number };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return [0, 0, 0];
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) =>
    clamp(Math.round(x), 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const u = clamp(t, 0, 1);
  return rgbToHex(
    A[0] + (B[0] - A[0]) * u,
    A[1] + (B[1] - A[1]) * u,
    A[2] + (B[2] - A[2]) * u,
  );
}

export type AmbientGradientEndpoints = { top: string; bottom: string };

/**
 * Map lux to sun-palette position: linear 0…cap → stops 0…`AMBIENT_LUX_SCRUB_MAX_STOP_INDEX`
 * (bright day band). ≥ cap hits max stop — **not** palette index 11 (dusk).
 */
export function luxToAmbientStopIndex(lux: number): number {
  const cap = Math.max(1, AMBIENT_LUX_SCRUB_PALETTE_CAP_LUX);
  const brightSpan = Math.max(0.5, AMBIENT_LUX_SCRUB_MAX_STOP_INDEX);
  const x = Math.max(0, Number(lux));
  const u = Math.min(1, x / cap);
  return u * brightSpan;
}

/** Smooth blend along palette stops; `s` in [0, 11]. */
export function colorAtStopIndex(s: number): string {
  const maxIdx = AMBIENT_LIGHT_COLORS.length - 1;
  const sc = clamp(s, 0, maxIdx);
  const i = Math.min(maxIdx - 1, Math.floor(sc));
  const f = sc - i;
  return lerpColor(
    AMBIENT_LIGHT_COLORS[i]!,
    AMBIENT_LIGHT_COLORS[i + 1]!,
    f,
  );
}

export function ambientGradientEndpointsAtStop(s: number): AmbientGradientEndpoints {
  const sc = clamp(s, 0, AMBIENT_LIGHT_COLORS.length - 1);
  return {
    top: colorAtStopIndex(sc - AMBIENT_VERTICAL_STOP_SPREAD),
    bottom: colorAtStopIndex(sc + AMBIENT_VERTICAL_STOP_SPREAD),
  };
}

export function ambientPageGradientCss(endpoints: AmbientGradientEndpoints): string {
  return `linear-gradient(180deg, ${endpoints.top}, ${endpoints.bottom})`;
}

export function lerpAmbientEndpoints(
  a: AmbientGradientEndpoints,
  b: AmbientGradientEndpoints,
  t: number,
): AmbientGradientEndpoints {
  const u = clamp(t, 0, 1);
  return {
    top: lerpColor(a.top, b.top, u),
    bottom: lerpColor(a.bottom, b.bottom, u),
  };
}

/**
 * Piecewise-linear map from wall time to palette position using sun anchors.
 * Falls back to uniform mapping along the chart window when `sun` is null.
 */
export function buildAmbientTimeKnots(
  chartStartMs: number,
  chartEndMs: number,
  sun: ChartSunMarkersIso | null,
): AmbientTimeKnot[] {
  if (!sun) {
    return [
      { t: chartStartMs, stop: 0 },
      { t: chartEndMs, stop: AMBIENT_LIGHT_COLORS.length - 1 },
    ];
  }

  const civilDawn = new Date(sun.civilDawn).getTime();
  const sunrise = new Date(sun.sunrise).getTime();
  const solarNoon = new Date(sun.solarNoon).getTime();
  const sunset = new Date(sun.sunset).getTime();
  const civilDusk = new Date(sun.civilDusk).getTime();

  const knots: AmbientTimeKnot[] = [
    { t: chartStartMs, stop: 0 },
    { t: civilDawn, stop: 1 },
    { t: sunrise, stop: 2 },
  ];

  const morningSpan = solarNoon - sunrise;
  if (morningSpan > 0) {
    knots.push(
      { t: sunrise + morningSpan * 0.25, stop: 3 },
      { t: sunrise + morningSpan * 0.5, stop: 4 },
      { t: sunrise + morningSpan * 0.75, stop: 5 },
    );
  } else {
    knots.push({ t: sunrise, stop: 4 });
  }
  knots.push({ t: solarNoon, stop: 6 });

  const afternoonSpan = sunset - solarNoon;
  if (afternoonSpan > 0) {
    knots.push(
      { t: solarNoon + afternoonSpan * (1 / 3), stop: 7 },
      { t: solarNoon + afternoonSpan * (2 / 3), stop: 8 },
    );
  }
  knots.push({ t: sunset, stop: 9 });

  const duskSpan = civilDusk - sunset;
  if (duskSpan > 0) {
    knots.push({ t: sunset + duskSpan * 0.5, stop: 10 });
  } else {
    knots.push({ t: sunset, stop: 10 });
  }
  knots.push({ t: civilDusk, stop: 10.5 });
  knots.push({ t: chartEndMs, stop: 11 });

  knots.sort((a, b) => a.t - b.t);

  const merged: AmbientTimeKnot[] = [];
  for (const k of knots) {
    const prev = merged[merged.length - 1];
    if (prev && k.t <= prev.t) {
      prev.stop = Math.max(prev.stop, k.stop);
      continue;
    }
    merged.push({ t: k.t, stop: k.stop });
  }

  for (let i = 1; i < merged.length; i++) {
    if (merged[i]!.stop < merged[i - 1]!.stop) {
      merged[i]!.stop = merged[i - 1]!.stop;
    }
  }

  return merged;
}

export function timeMsToStopIndex(tMs: number, knots: AmbientTimeKnot[]): number {
  if (knots.length < 2) return 0;
  const t = clamp(tMs, knots[0]!.t, knots[knots.length - 1]!.t);
  let i = 0;
  while (i < knots.length - 2 && knots[i + 1]!.t < t) i++;
  const a = knots[i]!;
  const b = knots[i + 1]!;
  const span = b.t - a.t;
  if (span <= 0) return b.stop;
  const u = (t - a.t) / span;
  return a.stop + (b.stop - a.stop) * u;
}

export function computeAmbientPageGradient(
  timeMs: number,
  knots: AmbientTimeKnot[],
): string {
  const s = timeMsToStopIndex(timeMs, knots);
  return ambientPageGradientCss(ambientGradientEndpointsAtStop(s));
}

export function computeAmbientPageGradientFromLux(lux: number): string {
  return ambientPageGradientCss(ambientGradientEndpointsAtStop(luxToAmbientStopIndex(lux)));
}
