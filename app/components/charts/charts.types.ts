import type { ChartDayTitleParts } from "@/app/lib/readings/dateUtils";

export type { ChartDayTitleParts };
import type { LuxChartPoint, LuxDualPoint } from "@/app/lib/readings/readings.types";
import type { ChartSunMarkersIso } from "@/app/lib/readings/sunChartBounds";

export type SunMarkerKind = keyof ChartSunMarkersIso;

export type SunMarkerLayout = {
  kind: SunMarkerKind;
  label: string;
  t: Date;
  x: number;
};

export type TooltipSingle = { kind: "single"; point: LuxChartPoint };
export type TooltipDual = { kind: "dual"; point: LuxDualPoint };
export type TooltipSun = {
  kind: "sun";
  label: string;
  timeLabel: string;
};

export type ChartTooltipData = TooltipSingle | TooltipDual | TooltipSun;

/** Spotlight sits on the line(s) at the nearest time bucket, not at raw pointer coords. */
export type CurveSpotlights =
  | null
  | { mode: "single"; x: number; y: number }
  | { mode: "dual"; x: number; yA: number; yB: number };

export type LuxReadingsSingleChartInnerProps = {
  width: number;
  dayStart: Date;
  dayEnd: Date;
  points: LuxChartPoint[];
  dual?: { sensorA: string; sensorB: string; points: LuxDualPoint[] };
  yDomain?: [number, number];
  sunMarkers?: ChartSunMarkersIso | null;
  /** Main-plot scrub: wall time under cursor (ms); `null` when pointer leaves plot or exits inner bounds (neutral page bg). */
  onAmbientScrubTime?: (timeMs: number | null) => void;
  /** Centered over main plot (Metal); e.g. no buckets for current filters. */
  emptyPlotMessage?: string | null;
};

export type LuxReadingsSingleChartProps = {
  /** Centered chart heading: date row + weekday row (theme colors). */
  chartDayTitle?: ChartDayTitleParts | null;
  observerLocationLabel?: string | null;
  dayStartIso: string;
  dayEndIso: string;
  points: LuxChartPoint[];
  dual?: { sensorA: string; sensorB: string; points: LuxDualPoint[] };
  /** Civil dawn/dusk + sunrise/sunset at observer coords; omitted when lat/lng unset. */
  sunMarkers?: ChartSunMarkersIso | null;
  yDomain?: [number, number];
  className?: string;
  onAmbientScrubTime?: (timeMs: number | null) => void;
  /** Shown centered on plot when set (Metal). */
  emptyPlotMessage?: string | null;
};

export type LuxSunGlyphPointerPayload = {
  label: string;
  timeLabel: string;
  /** X in main plot inner coordinates (for tooltip position). */
  anchorX: number;
};
