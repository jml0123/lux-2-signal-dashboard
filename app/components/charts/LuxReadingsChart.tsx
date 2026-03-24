"use client";

import { AxisBottom } from "@visx/axis";
import { Brush } from "@visx/brush";
import type BaseBrush from "@visx/brush/lib/BaseBrush";
import type { BrushHandleRenderProps } from "@visx/brush/lib/BrushHandle";
import type { Bounds } from "@visx/brush/lib/types";
import { curveMonotoneX } from "@visx/curve";
import { localPoint } from "@visx/event";
import {
  GlyphCircle,
  GlyphDiamond,
  GlyphSquare,
  GlyphStar,
} from "@visx/glyph";
import { Group } from "@visx/group";
import { PatternLines } from "@visx/pattern";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleUtc } from "@visx/scale";
import { Area, AreaClosed, LinePath } from "@visx/shape";
import { defaultStyles, Tooltip, useTooltip } from "@visx/tooltip";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { luxAreaGradientStopSpecs } from "@/app/lib/readings/readings.constants";
import type { ChartSunMarkersIso } from "@/app/lib/readings/sunChartBounds";
import type { LuxChartPoint, LuxDualPoint } from "@/app/lib/readings/readings.types";
import { dashboardTheme } from "@/app/lib/theme/dashboardTheme";

const defaultYDomain: [number, number] = [0, 4095];
const margin = { top: 12, right: 16, bottom: 44, left: 12 };
/** Follows pointer on the plot (spotlight). */
const CURSOR_MARKER_EMOJI = "\u{1F526}";
/** Space between the main chart and the brush holder (visx-style separation). */
const chartSeparation = 36;
/** Inset inside the rounded brush “holder” card. */
const brushHolderPadding = { top: 14, bottom: 16, left: 16, right: 16 };
const overviewInnerHeight = 52;
/** @visx/glyph symbol size (see [visx glyphs](https://visx.airbnb.tech/glyphs)). */
const SUN_GLYPH_SIZE = 44;
const SUN_GLYPH_TOP = 14;
/** Invisible hit target radius (px) around each sun glyph for tooltips. */
const SUN_GLYPH_HIT_R = 22;

type SunMarkerKind = keyof ChartSunMarkersIso;

function SunGlyphShape({
  kind,
  left,
  top,
  size = SUN_GLYPH_SIZE,
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

const SUN_MARKER_META: { kind: SunMarkerKind; label: string }[] = [
  { kind: "civilDawn", label: "Civil dawn" },
  { kind: "sunrise", label: "Sunrise" },
  { kind: "solarNoon", label: "Solar noon" },
  { kind: "sunset", label: "Sunset" },
  { kind: "civilDusk", label: "Civil dusk" },
];

function formatXTick(v: Date | number) {
  const d = v instanceof Date ? v : new Date(v);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatTimeLabel(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function nearestLuxPoint(points: LuxChartPoint[], tMs: number): LuxChartPoint | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.abs(new Date(p.time).getTime() - tMs);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Left/right resize handles for `@visx/brush` (see Visx brush example `renderBrushHandle`). */
function BrushResizeHandle({ x, height, isBrushActive }: BrushHandleRenderProps) {
  const pathW = 8;
  const pathH = 16;
  if (!isBrushActive) return null;
  return (
    <Group left={x + pathW / 2} top={(height - pathH) / 2}>
      <path
        fill="var(--app-field-surface)"
        d="M -4.5 0.5 L 3.5 0.5 L 3.5 15.5 L -4.5 15.5 L -4.5 0.5 M -1.5 4 L -1.5 12 M 0.5 4 L 0.5 12"
        stroke={dashboardTheme.chartGlyphStroke}
        strokeWidth={1}
        style={{ cursor: "ew-resize" }}
      />
    </Group>
  );
}

function nearestDualPoint(points: LuxDualPoint[], tMs: number): LuxDualPoint | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.abs(new Date(p.time).getTime() - tMs);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

type TooltipSingle = { kind: "single"; point: LuxChartPoint };
type TooltipDual = { kind: "dual"; point: LuxDualPoint };
type TooltipSun = {
  kind: "sun";
  label: string;
  timeLabel: string;
};

type ChartTooltipData = TooltipSingle | TooltipDual | TooltipSun;

/** Spotlight sits on the line(s) at the nearest time bucket, not at raw pointer coords. */
type CurveSpotlights =
  | null
  | { mode: "single"; x: number; y: number }
  | { mode: "dual"; x: number; yA: number; yB: number };

type LuxReadingsChartInnerProps = {
  width: number;
  dayStart: Date;
  dayEnd: Date;
  points: LuxChartPoint[];
  dual?: { sensorA: string; sensorB: string; points: LuxDualPoint[] };
  yDomain?: [number, number];
  sunMarkers?: ChartSunMarkersIso | null;
};

type SunMarkerLayout = {
  kind: SunMarkerKind;
  label: string;
  t: Date;
  x: number;
};

function LuxReadingsChartInner({
  width,
  dayStart,
  dayEnd,
  points,
  dual,
  yDomain = defaultYDomain,
  sunMarkers = null,
}: LuxReadingsChartInnerProps) {
  const plotHeight = 300;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = plotHeight - margin.top - margin.bottom;
  const brushInnerWidth = Math.max(
    0,
    innerWidth - brushHolderPadding.left - brushHolderPadding.right,
  );
  const brushStageHeight =
    overviewInnerHeight + brushHolderPadding.top + brushHolderPadding.bottom;
  const svgHeight =
    margin.top +
    innerHeight +
    chartSeparation +
    brushStageHeight +
    margin.bottom;

  const brushRef = useRef<BaseBrush | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[Date, Date]>(() => [
    dayStart,
    dayEnd,
  ]);

  const brushXScale = useMemo(
    () =>
      scaleUtc<number>({
        domain: [dayStart, dayEnd],
        range: [0, brushInnerWidth],
      }),
    [dayStart, dayEnd, brushInnerWidth],
  );

  const showDual = Boolean(dual && dual.points.length >= 2);
  const showSingle = !showDual && points.length >= 2;

  const overviewPoints: LuxChartPoint[] = useMemo(() => {
    if (showDual && dual) {
      return dual.points.map((p) => ({
        time: p.time,
        lux: (p.luxA + p.luxB) / 2,
      }));
    }
    return points;
  }, [showDual, dual, points]);

  const overviewLuxMax = useMemo(() => {
    if (overviewPoints.length === 0) return yDomain[1];
    return Math.max(yDomain[1], ...overviewPoints.map((p) => p.lux));
  }, [overviewPoints, yDomain]);

  const brushYScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, overviewLuxMax || 1],
        range: [overviewInnerHeight, 0],
        nice: true,
      }),
    [overviewLuxMax],
  );

  const xScale = useMemo(
    () =>
      scaleUtc<number>({
        domain: zoomDomain,
        range: [0, innerWidth],
      }),
    [zoomDomain, innerWidth],
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: yDomain,
        range: [innerHeight, 0],
        nice: true,
      }),
    [innerHeight, yDomain],
  );

  const mainSunLayout = useMemo((): SunMarkerLayout[] => {
    if (!sunMarkers) return [];
    const out: SunMarkerLayout[] = [];
    for (const { kind, label } of SUN_MARKER_META) {
      const t = new Date(sunMarkers[kind]);
      const x = xScale(t);
      if (!Number.isFinite(x) || x < -1 || x > innerWidth + 1) continue;
      out.push({ kind, label, t, x });
    }
    return out;
  }, [sunMarkers, xScale, innerWidth]);

  const brushSunLayout = useMemo((): SunMarkerLayout[] => {
    if (!sunMarkers) return [];
    const out: SunMarkerLayout[] = [];
    for (const { kind, label } of SUN_MARKER_META) {
      const t = new Date(sunMarkers[kind]);
      const x = brushXScale(t);
      if (!Number.isFinite(x) || x < -1 || x > brushInnerWidth + 1) continue;
      out.push({ kind, label, t, x });
    }
    return out;
  }, [sunMarkers, brushXScale, brushInnerWidth]);

  const chartUid = useId().replace(/:/g, "");
  const brushPatternId = `lux-brush-pattern-${chartUid}`;
  const luxAreaGradientId = `lux-area-gradient-${chartUid}`;

  const singleSeriesGradientStops = useMemo(
    () => luxAreaGradientStopSpecs(yScale, innerHeight),
    [yScale, innerHeight],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [curveSpotlights, setCurveSpotlights] = useState<CurveSpotlights>(null);

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<ChartTooltipData>();

  const isZoomed =
    zoomDomain[0].getTime() !== dayStart.getTime() ||
    zoomDomain[1].getTime() !== dayEnd.getTime();

  const onBrushChange = useCallback(
    (domain: Bounds | null) => {
      if (!domain) return;
      const lo = Math.min(Number(domain.x0), Number(domain.x1));
      const hi = Math.max(Number(domain.x0), Number(domain.x1));
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
      setZoomDomain([
        new Date(Math.max(lo, dayStart.getTime())),
        new Date(Math.min(hi, dayEnd.getTime())),
      ]);
    },
    [dayStart, dayEnd],
  );

  const resetZoom = useCallback(() => {
    setZoomDomain([dayStart, dayEnd]);
    brushRef.current?.reset();
  }, [dayStart, dayEnd]);

  const onPlotPointerMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      const pt = localPoint(event);
      if (
        pt === null ||
        pt.x < 0 ||
        pt.x > innerWidth ||
        pt.y < 0 ||
        pt.y > innerHeight
      ) {
        setCurveSpotlights(null);
        return;
      }

      const t = xScale.invert(pt.x).getTime();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      if ((dual?.points?.length ?? 0) >= 2) {
        const hit = nearestDualPoint(dual!.points, t);
        if (!hit) {
          setCurveSpotlights(null);
          return;
        }
        const x = xScale(new Date(hit.time)) ?? 0;
        const yA = yScale(hit.luxA) ?? 0;
        const yB = yScale(hit.luxB) ?? 0;
        setCurveSpotlights({ mode: "dual", x, yA, yB });
        showTooltip({
          tooltipLeft: event.clientX - rect.left,
          tooltipTop: event.clientY - rect.top,
          tooltipData: { kind: "dual", point: hit },
        });
      } else if (points.length >= 2) {
        const hit = nearestLuxPoint(points, t);
        if (!hit) {
          setCurveSpotlights(null);
          return;
        }
        const x = xScale(new Date(hit.time)) ?? 0;
        const y = yScale(hit.lux) ?? 0;
        setCurveSpotlights({ mode: "single", x, y });
        showTooltip({
          tooltipLeft: event.clientX - rect.left,
          tooltipTop: event.clientY - rect.top,
          tooltipData: { kind: "single", point: hit },
        });
      } else {
        setCurveSpotlights(null);
      }
    },
    [dual, points, xScale, yScale, showTooltip, innerWidth, innerHeight],
  );

  const onPlotPointerLeave = useCallback(() => {
    setCurveSpotlights(null);
    hideTooltip();
  }, [hideTooltip]);

  return (
    <div ref={containerRef} className="relative">
      {isZoomed ? (
        <button
          type="button"
          onClick={resetZoom}
          className="absolute right-0 top-0 z-10 rounded-md border px-2 py-1 text-xs font-medium shadow-sm transition-colors"
          style={{
            borderColor: "var(--app-card-border)",
            background: "var(--app-field-surface)",
            color: "var(--app-text-muted)",
          }}
        >
          Reset zoom
        </button>
      ) : null}

      <svg
        width={width}
        height={svgHeight}
        role="img"
        aria-label="Lux readings chart"
      >
        <title>Lux readings — hover for values, brush below to zoom time</title>
        <defs>
          <PatternLines
            id={brushPatternId}
            width={10}
            height={10}
            stroke={dashboardTheme.chartStroke}
            strokeWidth={1}
            orientation={["diagonal"]}
            background="rgba(148, 197, 151, 0.22)"
          />
        </defs>
        <Group left={margin.left} top={margin.top}>
          <defs>
            <linearGradient
              id={luxAreaGradientId}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={innerHeight}
              x2={0}
              y2={0}
            >
              {singleSeriesGradientStops.map((s, i) => (
                <stop
                  key={`${s.offsetPct}-${i}`}
                  offset={`${s.offsetPct}%`}
                  stopColor={s.color}
                />
              ))}
            </linearGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="var(--chart-plot-bg)"
          />
          {mainSunLayout.map(({ kind, x }) => (
            <g key={`${kind}-grid`} style={{ pointerEvents: "none" }} aria-hidden="true">
              <line
                x1={x}
                x2={x}
                y1={0}
                y2={innerHeight}
                stroke="var(--chart-sun-line)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            </g>
          ))}
          {showDual ? (
            <>
              <Area<LuxDualPoint>
                data={dual!.points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y0={(d) => yScale(Math.min(d.luxA, d.luxB))}
                y1={(d) => yScale(Math.max(d.luxA, d.luxB))}
                curve={curveMonotoneX}
                fill={`url(#${luxAreaGradientId})`}
                fillOpacity={0.92}
              />
              <LinePath<LuxDualPoint>
                data={dual!.points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y={(d) => yScale(d.luxA)}
                curve={curveMonotoneX}
                stroke="var(--chart-line)"
                strokeWidth={1.75}
                fill="none"
              />
              <LinePath<LuxDualPoint>
                data={dual!.points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y={(d) => yScale(d.luxB)}
                curve={curveMonotoneX}
                stroke="var(--chart-line)"
                strokeWidth={1.75}
                strokeDasharray="6 4"
                fill="none"
              />
            </>
          ) : null}

          {showSingle ? (
            <>
              <AreaClosed<LuxChartPoint>
                data={points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y={(d) => yScale(d.lux) ?? 0}
                yScale={yScale}
                curve={curveMonotoneX}
                fill={`url(#${luxAreaGradientId})`}
              />
              <LinePath<LuxChartPoint>
                data={points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y={(d) => yScale(d.lux) ?? 0}
                curve={curveMonotoneX}
                stroke="var(--chart-line)"
                strokeWidth={1.75}
                fill="none"
              />
            </>
          ) : null}

          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            style={{ touchAction: "none" }}
            onPointerMove={onPlotPointerMove}
            onPointerLeave={onPlotPointerLeave}
          />

          {mainSunLayout.map(({ kind, label, t, x }) => (
            <g key={`${kind}-glyph`} style={{ pointerEvents: "auto" }}>
              <SunGlyphShape kind={kind} left={x} top={SUN_GLYPH_TOP} />
              <circle
                cx={x}
                cy={SUN_GLYPH_TOP}
                r={SUN_GLYPH_HIT_R}
                fill="transparent"
                style={{ cursor: "default" }}
                aria-label={`${label}, ${formatXTick(t)}`}
                onPointerEnter={() => {
                  showTooltip({
                    tooltipLeft: margin.left + x,
                    tooltipTop: margin.top + SUN_GLYPH_TOP,
                    tooltipData: {
                      kind: "sun",
                      label,
                      timeLabel: formatXTick(t),
                    },
                  });
                }}
                onPointerLeave={hideTooltip}
              />
            </g>
          ))}

          {curveSpotlights?.mode === "single" ? (
            <text
              x={curveSpotlights.x}
              y={curveSpotlights.y - 10}
              fontSize={20}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                pointerEvents: "none",
                userSelect: "none",
                fontFamily:
                  "system-ui, 'Segoe UI', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
              }}
            >
              {CURSOR_MARKER_EMOJI}
            </text>
          ) : null}
          {curveSpotlights?.mode === "dual" ? (
            <>
              <text
                x={
                  curveSpotlights.x +
                  (Math.abs(curveSpotlights.yA - curveSpotlights.yB) < 20
                    ? -14
                    : 0)
                }
                y={curveSpotlights.yA - 10}
                fontSize={20}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                  fontFamily:
                    "system-ui, 'Segoe UI', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
                }}
              >
                {CURSOR_MARKER_EMOJI}
              </text>
              <text
                x={
                  curveSpotlights.x +
                  (Math.abs(curveSpotlights.yA - curveSpotlights.yB) < 20
                    ? 14
                    : 0)
                }
                y={curveSpotlights.yB - 10}
                fontSize={20}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                  fontFamily:
                    "system-ui, 'Segoe UI', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
                }}
              >
                {CURSOR_MARKER_EMOJI}
              </text>
            </>
          ) : null}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickFormat={formatXTick as never}
            stroke="var(--chart-axis)"
            tickStroke="var(--chart-axis)"
            numTicks={8}
            tickLabelProps={{
              fill: "var(--chart-tick)",
              fontSize: 11,
              textAnchor: "middle",
            }}
          />
        </Group>

        <Group
          left={margin.left}
          top={margin.top + innerHeight + chartSeparation}
        >
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={brushStageHeight}
            rx={8}
            fill="var(--app-brush-holder-fill)"
            stroke="var(--app-brush-holder-border)"
            strokeWidth={1}
          />
          <Group
            left={brushHolderPadding.left}
            top={brushHolderPadding.top}
          >
            {brushSunLayout.map(({ kind, label, t, x }) => (
              <g key={kind} style={{ pointerEvents: "none" }} aria-hidden="true">
                <title>{`${label} — ${formatXTick(t)}`}</title>
                <line
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={overviewInnerHeight}
                  stroke="var(--chart-sun-line)"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.65}
                />
              </g>
            ))}
            {overviewPoints.length >= 2 ? (
              <AreaClosed<LuxChartPoint>
                data={overviewPoints}
                x={(d) => brushXScale(new Date(d.time)) ?? 0}
                y={(d) => brushYScale(d.lux) ?? 0}
                yScale={brushYScale}
                curve={curveMonotoneX}
                fill="var(--palette-celadon)"
                fillOpacity={0.85}
                style={{ pointerEvents: "none" }}
              />
            ) : null}
            <Brush
              innerRef={brushRef}
              xScale={brushXScale}
              yScale={brushYScale}
              width={brushInnerWidth}
              height={overviewInnerHeight}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              handleSize={8}
              brushDirection="horizontal"
              resizeTriggerAreas={["left", "right"]}
              onChange={onBrushChange}
              onClick={() => {
                setZoomDomain([dayStart, dayEnd]);
                brushRef.current?.reset();
              }}
              selectedBoxStyle={{
                fill: `url(#${brushPatternId})`,
                stroke: "var(--chart-brush-selection-stroke)",
                strokeWidth: 1.5,
              }}
              renderBrushHandle={(props) => <BrushResizeHandle {...props} />}
              useWindowMoveEvents
              disableDraggingSelection={false}
            />
          </Group>
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <Tooltip
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: "var(--chart-tooltip-bg)",
            color: "var(--chart-tooltip-fg)",
            border: "none",
            borderRadius: "6px",
            fontSize: 12,
            padding: "8px 10px",
            zIndex: 20,
            ...(tooltipData.kind === "sun"
              ? {
                  transform: "translate(-50%, calc(-100% - 8px))",
                  pointerEvents: "none",
                  textAlign: "center",
                }
              : {}),
          }}
          applyPositionStyle
        >
          {tooltipData.kind === "single" ? (
            <div className="flex flex-col gap-0.5">
              <div>{formatTimeLabel(tooltipData.point.time)}</div>
              <div className="font-medium tabular-nums">
                {Math.round(tooltipData.point.lux)} lux
              </div>
            </div>
          ) : tooltipData.kind === "dual" ? (
            <div className="flex flex-col gap-1">
              <div>{formatTimeLabel(tooltipData.point.time)}</div>
              <div className="tabular-nums">
                <span style={{ color: "var(--palette-celadon)" }}>
                  {tooltipData.point.sensorA}:
                </span>{" "}
                {Math.round(tooltipData.point.luxA)} lux
              </div>
              <div className="tabular-nums">
                <span style={{ color: "var(--palette-sea-green)" }}>
                  {tooltipData.point.sensorB}:
                </span>{" "}
                {Math.round(tooltipData.point.luxB)} lux
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <div className="font-semibold">{tooltipData.label}</div>
              <div className="tabular-nums opacity-90">
                {tooltipData.timeLabel}
              </div>
            </div>
          )}
        </Tooltip>
      )}
    </div>
  );
}

export type LuxReadingsChartProps = {
  /** Human-readable calendar day for this chart (e.g. light data for that day). */
  dayTitle?: string;
  dayStartIso: string;
  dayEndIso: string;
  points: LuxChartPoint[];
  dual?: { sensorA: string; sensorB: string; points: LuxDualPoint[] };
  /** Civil dawn/dusk + sunrise/sunset at observer coords; omitted when lat/lng unset. */
  sunMarkers?: ChartSunMarkersIso | null;
  yDomain?: [number, number];
  className?: string;
};

export function LuxReadingsChart({
  dayTitle,
  dayStartIso,
  dayEndIso,
  points,
  dual,
  sunMarkers = null,
  yDomain,
  className,
}: LuxReadingsChartProps) {
  const dayStart = useMemo(() => new Date(dayStartIso), [dayStartIso]);
  const dayEnd = useMemo(() => new Date(dayEndIso), [dayEndIso]);

  return (
    <div className={className ?? "w-full min-h-[380px]"}>
      {dayTitle ? (
        <h2
          className="mb-3 text-lg font-semibold tracking-tight"
          style={{ color: "var(--app-text)" }}
        >
          {dayTitle}
        </h2>
      ) : null}
      <ParentSize debounceTime={10}>
        {({ width }) =>
          width < 8 ? null : (
            <LuxReadingsChartInner
              width={width}
              dayStart={dayStart}
              dayEnd={dayEnd}
              points={points}
              dual={dual}
              yDomain={yDomain}
              sunMarkers={sunMarkers}
            />
          )
        }
      </ParentSize>
    </div>
  );
}
