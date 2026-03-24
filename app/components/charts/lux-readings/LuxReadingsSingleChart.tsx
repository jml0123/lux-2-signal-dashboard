"use client";

import { curveNatural } from "@visx/curve";
import { localPoint } from "@visx/event";
import { Group } from "@visx/group";
import { PatternLines } from "@visx/pattern";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleUtc } from "@visx/scale";
import { Area, AreaClosed, LinePath } from "@visx/shape";
import type BaseBrush from "@visx/brush/lib/BaseBrush";
import type { Bounds } from "@visx/brush/lib/types";
import { defaultStyles, Tooltip, useTooltip } from "@visx/tooltip";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type {
  ChartTooltipData,
  CurveSpotlights,
  LuxReadingsSingleChartInnerProps,
  LuxReadingsSingleChartProps,
  SunMarkerLayout,
} from "@/app/components/charts/charts.types";
import {
  formatTimeLabel,
  formatXTick,
  nearestDualPoint,
  nearestLuxPoint,
} from "@/app/lib/readings/chartPointerUtils";
import { luxAreaGradientStopSpecs } from "@/app/lib/readings/readings.constants";
import type { LuxChartPoint, LuxDualPoint } from "@/app/lib/readings/readings.types";
import { dashboardTheme } from "@/app/lib/theme/dashboardTheme";
import { LuxReadingsChartTooltipContent } from "./LuxReadingsChartTooltip";
import { LuxReadingsBrushStrip } from "./LuxReadingsBrushStrip";
import {
  LuxSunGlyphsInteractive,
  SUN_MARKER_META,
} from "./LuxReadingsGlyphs";

// --- Lux chart layout (tweak here) -----------------------------------------

const defaultYDomain: [number, number] = [0, 4095];
const margin = { top: 12, right: 8, bottom: 44, left: 8 };
/** Follows pointer on the plot (spotlight). */
const CURSOR_MARKER_EMOJI = "\u{1F526}";
/** Space between the main chart and the brush holder (visx-style separation). */
const chartSeparation = 36;
/** Inset inside the rounded brush “holder” card. */
const brushHolderPadding = { top: 14, bottom: 16, left: 16, right: 16 };
const overviewInnerHeight = 52;
/** Main plot total height (includes `margin` top/bottom). */
const plotHeight = 380;
/** Natural cubic spline — passes through points with long, smooth arcs between buckets. */
const luxLineCurve = curveNatural;
/** Area fill: low opacity so the gradient fades into `--chart-plot-bg`. */
const luxAreaFillOpacity = 0.12;
const luxBrushAreaFillOpacity = 0.19;
/** SVG text: align with global `font-sans` (Noto Sans). */
const chartSansFontFamily =
  "var(--font-sans), ui-sans-serif, system-ui, sans-serif";
const chartEmojiMarkerFontFamily =
  'var(--font-sans), "Apple Color Emoji", "Segoe UI Emoji", ui-sans-serif, sans-serif';
/** Sun glyph vertical position in main plot inner coordinates. */
const LUX_SUN_GLYPH_TOP = 14;
const LUX_SUN_GLYPH_HIT_R = 22;

// ---------------------------------------------------------------------------

function LuxReadingsSingleChartInner({
  width,
  dayStart,
  dayEnd,
  points,
  dual,
  yDomain = defaultYDomain,
  sunMarkers = null,
}: LuxReadingsSingleChartInnerProps) {
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

  const edgeTimeLabels = useMemo(() => {
    if (isZoomed) {
      return {
        left: formatXTick(zoomDomain[0]),
        right: formatXTick(zoomDomain[1]),
      };
    }

    const dawn = sunMarkers?.civilDawn ? new Date(sunMarkers.civilDawn) : dayStart;
    const dusk = sunMarkers?.civilDusk ? new Date(sunMarkers.civilDusk) : dayEnd;
    return {
      left: `₊☀︎✧ Dawn ${formatXTick(dawn)}`,
      right: `⋆☼. Dusk ${formatXTick(dusk)}`,
    };
  }, [isZoomed, zoomDomain, sunMarkers, dayStart, dayEnd]);

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

  const onBrushResetClick = useCallback(() => {
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

  const onSunPointerEnter = useCallback(
    (payload: {
      label: string;
      timeLabel: string;
      anchorX: number;
    }) => {
      showTooltip({
        tooltipLeft: margin.left + payload.anchorX,
        tooltipTop: margin.top + LUX_SUN_GLYPH_TOP,
        tooltipData: {
          kind: "sun",
          label: payload.label,
          timeLabel: payload.timeLabel,
        },
      });
    },
    [showTooltip],
  );

  const brushSunLineDecorations = useMemo(
    () =>
      brushSunLayout.map(({ kind, label, t, x }) => (
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
      )),
    [brushSunLayout],
  );

  return (
    <div ref={containerRef} className="relative">
      {isZoomed ? (
        <button
          type="button"
          onClick={onBrushResetClick}
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
                curve={luxLineCurve}
                fill={`url(#${luxAreaGradientId})`}
                fillOpacity={luxAreaFillOpacity}
              />
              <LinePath<LuxDualPoint>
                data={dual!.points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y={(d) => yScale(d.luxA)}
                curve={luxLineCurve}
                stroke="var(--chart-line)"
                strokeWidth={1.75}
                fill="none"
              />
              <LinePath<LuxDualPoint>
                data={dual!.points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y={(d) => yScale(d.luxB)}
                curve={luxLineCurve}
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
                curve={luxLineCurve}
                fill={`url(#${luxAreaGradientId})`}
                fillOpacity={luxAreaFillOpacity}
              />
              <LinePath<LuxChartPoint>
                data={points}
                x={(d) => xScale(new Date(d.time)) ?? 0}
                y={(d) => yScale(d.lux) ?? 0}
                curve={luxLineCurve}
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

          <LuxSunGlyphsInteractive
            layouts={mainSunLayout}
            glyphTop={LUX_SUN_GLYPH_TOP}
            hitRadius={LUX_SUN_GLYPH_HIT_R}
            formatTime={formatXTick}
            onSunPointerEnter={onSunPointerEnter}
            onSunPointerLeave={hideTooltip}
          />

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
                fontFamily: chartEmojiMarkerFontFamily,
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
                  fontFamily: chartEmojiMarkerFontFamily,
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
                  fontFamily: chartEmojiMarkerFontFamily,
                }}
              >
                {CURSOR_MARKER_EMOJI}
              </text>
            </>
          ) : null}

          <text
            x={0}
            y={innerHeight + 18}
            textAnchor="start"
            dominantBaseline="hanging"
            style={{
              fill: "var(--chart-tick)",
              fontSize: 11,
              fontFamily: chartEmojiMarkerFontFamily,
            }}
          >
            {edgeTimeLabels.left}
          </text>
          <text
            x={innerWidth}
            y={innerHeight + 18}
            textAnchor="end"
            dominantBaseline="hanging"
            style={{
              fill: "var(--chart-tick)",
              fontSize: 11,
              fontFamily: chartEmojiMarkerFontFamily,
            }}
          >
            {edgeTimeLabels.right}
          </text>
        </Group>

        <LuxReadingsBrushStrip
          outerGroupLeft={margin.left}
          outerGroupTop={margin.top + innerHeight + chartSeparation}
          innerWidth={innerWidth}
          brushStageHeight={brushStageHeight}
          brushHolderPadding={brushHolderPadding}
          brushInnerWidth={brushInnerWidth}
          overviewInnerHeight={overviewInnerHeight}
          brushPatternId={brushPatternId}
          overviewPoints={overviewPoints}
          brushXScale={brushXScale}
          brushYScale={brushYScale}
          brushRef={brushRef}
          onBrushChange={onBrushChange}
          onBrushResetClick={onBrushResetClick}
          luxLineCurve={luxLineCurve}
          luxBrushAreaFillOpacity={luxBrushAreaFillOpacity}
        >
          {brushSunLineDecorations}
        </LuxReadingsBrushStrip>
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
            fontFamily: chartSansFontFamily,
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
          <LuxReadingsChartTooltipContent
            data={tooltipData}
            formatTimeLabel={formatTimeLabel}
          />
        </Tooltip>
      )}
    </div>
  );
}

export type { LuxReadingsSingleChartProps } from "@/app/components/charts/charts.types";

export function LuxReadingsSingleChart({
  chartDayTitle,
  observerLocationLabel,
  dayStartIso,
  dayEndIso,
  points,
  dual,
  sunMarkers = null,
  yDomain,
  className,
}: LuxReadingsSingleChartProps) {
  const dayStart = useMemo(() => new Date(dayStartIso), [dayStartIso]);
  const dayEnd = useMemo(() => new Date(dayEndIso), [dayEndIso]);

  return (
    <div className={className ?? "w-full min-h-[500px]"}>
      <ParentSize debounceTime={10}>
        {({ width }) =>
          width < 8 ? null : (
            <LuxReadingsSingleChartInner
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
      {chartDayTitle ? (
        <div
          className="font-display mt-3 w-full pr-5 text-right sm:mt-4 sm:pr-7 md:pr-8"
          role="group"
          aria-label="Chart date"
        >
          <div className="text-sm leading-tight">
            <h2 className="flex flex-wrap items-center justify-end gap-x-2">
              <span
                className="font-normal tracking-tight"
                style={{ color: "var(--chart-title-date)" }}
              >
                {chartDayTitle.dateLine}
              </span>
              {chartDayTitle.weekdayLine ? (
                <span
                  className="font-bold tracking-tight"
                  style={{
                    color: "var(--chart-title-weekday)",
                    opacity: 0.88,
                  }}
                >
                  {chartDayTitle.weekdayLine}
                </span>
              ) : null}
            </h2>
            {observerLocationLabel ? (
              <div
                className="mt-0.5 font-normal tracking-tight"
                style={{
                  color: "var(--chart-title-weekday)",
                  opacity: 0.74,
                }}
              >
                {observerLocationLabel}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
