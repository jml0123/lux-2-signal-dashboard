import type { ChartSunMarkersIso } from "@/app/lib/readings/sunChartBounds";

/**
 * Ordered palette for one civil day on the chart axis (pre-dawn → post-dusk).
 * Index 0 and 11 match so scrubbing the chart ends loops seamlessly at deep navy.
 * Saturated for legibility through `--ambient-scrub-wash` on the page overlay.
 * Edit here only — knots map solar times onto stop indices 0…11.
 */
export const AMBIENT_LIGHT_COLORS: readonly string[] = [
  "#141a38", // 1  pre-dawn (blue-shifted navy)
  "#242174", // 2  civil twilight
  "#7a2f98", // 3  sunrise
  "#d4561c", // 4  just after sunrise
  "#f08522", // 5  morning
  "#ffc870", // 6  mid-morning
  "#fff2b0", // 7  solar noon (warm white)
  "#ffbe58", // 8  early afternoon
  "#ff9a30", // 9  late afternoon
  "#e45618", // 10 golden hour
  "#9c2f68", // 11 dusk
  "#141a38", // 12 post-dusk (loop to pre-dawn)
] as const;

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

function lerpColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const u = clamp(t, 0, 1);
  return rgbToHex(
    A[0] + (B[0] - A[0]) * u,
    A[1] + (B[1] - A[1]) * u,
    A[2] + (B[2] - A[2]) * u,
  );
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
  const top = colorAtStopIndex(s - AMBIENT_VERTICAL_STOP_SPREAD);
  const bottom = colorAtStopIndex(s + AMBIENT_VERTICAL_STOP_SPREAD);
  return `linear-gradient(180deg, ${top}, ${bottom})`;
}
