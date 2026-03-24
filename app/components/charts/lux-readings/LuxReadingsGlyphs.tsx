"use client";

import {
  GlyphCircle,
  GlyphDiamond,
  GlyphSquare,
  GlyphStar,
} from "@visx/glyph";
import type {
  LuxSunGlyphPointerPayload,
  SunMarkerKind,
  SunMarkerLayout,
} from "@/app/components/charts/charts.types";
import { dashboardTheme } from "@/app/lib/theme/dashboardTheme";

/** @visx/glyph symbol size (see [visx glyphs](https://visx.airbnb.tech/glyphs)). */
export const LUX_SUN_GLYPH_SIZE = 44;

export const SUN_MARKER_META: { kind: SunMarkerKind; label: string }[] = [
  { kind: "civilDawn", label: "Civil dawn" },
  { kind: "sunrise", label: "Sunrise" },
  { kind: "solarNoon", label: "Solar noon" },
  { kind: "sunset", label: "Sunset" },
  { kind: "civilDusk", label: "Civil dusk" },
];

export function SunGlyphShape({
  kind,
  left,
  top,
  size = LUX_SUN_GLYPH_SIZE,
}: {
  kind: SunMarkerKind;
  left: number;
  top: number;
  size?: number;
}) {
  const stroke = dashboardTheme.chartGlyphStroke;
  const strokeWidth = 1;
  switch (kind) {
    case "civilDawn":
      return (
        <GlyphSquare
          left={left}
          top={top}
          size={size}
          fill={dashboardTheme.chartSunCivilDawn}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "sunrise":
      return (
        <GlyphStar
          left={left}
          top={top}
          size={size}
          fill={dashboardTheme.chartSunSunrise}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "solarNoon":
      return (
        <GlyphDiamond
          left={left}
          top={top}
          size={size}
          fill={dashboardTheme.chartSunSolarNoon}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "sunset":
      return (
        <GlyphCircle
          left={left}
          top={top}
          size={size}
          fill={dashboardTheme.chartSunSunset}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "civilDusk":
      return (
        <GlyphSquare
          left={left}
          top={top}
          size={size}
          fill={dashboardTheme.chartSunCivilDusk}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    default:
      return null;
  }
}

export type LuxSunGlyphsInteractiveProps = {
  layouts: SunMarkerLayout[];
  glyphTop: number;
  hitRadius: number;
  formatTime: (d: Date) => string;
  onSunPointerEnter: (payload: LuxSunGlyphPointerPayload) => void;
  onSunPointerLeave: () => void;
};

export function LuxSunGlyphsInteractive({
  layouts,
  glyphTop,
  hitRadius,
  formatTime,
  onSunPointerEnter,
  onSunPointerLeave,
}: LuxSunGlyphsInteractiveProps) {
  return (
    <>
      {layouts.map(({ kind, label, t, x }) => (
        <g key={`${kind}-glyph`} style={{ pointerEvents: "auto" }}>
          <SunGlyphShape kind={kind} left={x} top={glyphTop} />
          <circle
            cx={x}
            cy={glyphTop}
            r={hitRadius}
            fill="transparent"
            style={{ cursor: "default" }}
            aria-label={`${label}, ${formatTime(t)}`}
            onPointerEnter={() =>
              onSunPointerEnter({
                label,
                timeLabel: formatTime(t),
                anchorX: x,
              })
            }
            onPointerLeave={onSunPointerLeave}
          />
        </g>
      ))}
    </>
  );
}
