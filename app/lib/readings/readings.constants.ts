/**
 * Lux bands for UI / chart styling. `color` is the hue at each band start for the area
 * gradient: **lower lux → darker green**, **higher lux → lighter green** (brighter scene).
 */
export const LUX_THRESHOLDS = [
  { label: "dark", min: 0, max: 100, color: "#2f5d40" },
  { label: "dim", min: 100, max: 500, color: "#3d6b48" },
  { label: "moderate", min: 500, max: 2000, color: "#62996d" },
  { label: "bright", min: 2000, max: 3000, color: "#94c597" },
  { label: "very bright", min: 3000, max: 4095, color: "#e8f4e9" },
] as const;

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
