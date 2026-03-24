/** First UTC calendar day present in the lux readings dataset (`YYYY-MM-DD`). */
export const READINGS_DATA_EPOCH_DATE = "2026-03-22";

/**
 * Lux bands for UI / chart styling. `color` is the hue at each band start for the area
 * gradient: **lower lux → deeper dusk**, **higher lux → airy gold/lilac** (brighter scene).
 * Matches `globals.css` ethereal palette (`--ethereal-*`). Tuned for transparent plot +
 * ambient page scrub.
 */
export const LUX_THRESHOLDS = [
  { label: "dark", min: 0, max: 100, color: "#3d3554" },
  { label: "dim", min: 100, max: 500, color: "#8b7ab8" },
  { label: "moderate", min: 500, max: 2000, color: "#7aaab8" },
  { label: "bright", min: 2000, max: 3000, color: "#a896cc" },
  { label: "very bright", min: 3000, max: 4095, color: "#e8ddaa" },
] as const;

/** Main + brush lux area fill opacities (0–1). Higher = more legible on busy backgrounds. */
export const LUX_CHART_AREA_FILL_OPACITY = 0.38;
export const LUX_CHART_BRUSH_AREA_FILL_OPACITY = 0.42;

/**
 * Dual-sensor mode: when |luxA − luxB| ≤ this (same bucket), the band is tinted with
 * `--chart-dual-overlap-fill` so agreement stands out from the divergent envelope.
 */
export const DUAL_SENSOR_OVERLAP_MAX_LUX = 120;

type LinearScale = {
  (n: number): number;
  domain: () => number[];
};

/**
 * SVG linearGradient stops: offset 0% = bottom of plot (low lux → darker stops), 100% = top
 * (high lux → lighter stops). Positions follow `yScale` (including `nice()` domain).
 */
export function luxAreaGradientStopSpecs(
  yScale: LinearScale,
  plotInnerHeight: number,
): { offsetPct: number; color: string }[] {
  const dom = yScale.domain();
  const d0 = dom[0] ?? 0;
  const d1 = dom[dom.length - 1] ?? 4095;
  const specs: { lux: number; color: string }[] = [
    { lux: LUX_THRESHOLDS[0].min, color: LUX_THRESHOLDS[0].color },
    { lux: LUX_THRESHOLDS[1].min, color: LUX_THRESHOLDS[1].color },
    { lux: LUX_THRESHOLDS[2].min, color: LUX_THRESHOLDS[2].color },
    { lux: LUX_THRESHOLDS[3].min, color: LUX_THRESHOLDS[3].color },
    { lux: LUX_THRESHOLDS[4].min, color: LUX_THRESHOLDS[4].color },
    { lux: LUX_THRESHOLDS[4].max, color: LUX_THRESHOLDS[4].color },
  ];

  const mapped = specs.map(({ lux, color }) => {
    const clamped = Math.min(Math.max(lux, d0), d1);
    const y = yScale(clamped);
    const offsetPct =
      Math.min(1, Math.max(0, (plotInnerHeight - y) / plotInnerHeight)) * 100;
    return { offsetPct, color };
  });

  mapped.sort((a, b) => a.offsetPct - b.offsetPct);

  // Collapse duplicate offsets (e.g. clamp edge) so SVG keeps valid stops
  const deduped: { offsetPct: number; color: string }[] = [];
  for (const s of mapped) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.offsetPct - s.offsetPct) < 0.0001) {
      deduped[deduped.length - 1] = s;
    } else {
      deduped.push(s);
    }
  }
  if (deduped.length < 2) {
    const c = deduped[0]?.color ?? LUX_THRESHOLDS[0].color;
    return [
      { offsetPct: 0, color: c },
      { offsetPct: 100, color: LUX_THRESHOLDS[4].color },
    ];
  }
  return deduped;
}
