"use client";

import { AxisBottom } from "@visx/axis";
import type { TickRendererProps } from "@visx/axis";
import { curveStepAfter } from "@visx/curve";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleUtc } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { Fragment, useMemo, useSyncExternalStore } from "react";
import {
  bucketedRowsToDualLuxPoints,
  bucketedRowsToLuxChartPoints,
  dualLuxPointsSeBottomNwTop,
  type LuxRidgeSeNwPoint,
} from "@/app/lib/readings/data/readings";
import {
  formatRidgelineAxisWeekday,
  getUtcDayBounds,
  ridgelineAxisNoonInstants,
  utcDateAddDays,
} from "@/app/lib/readings/dateUtils";
import { READINGS_STROKE_WIDTHS } from "@/app/lib/readings/readings.constants";
import type { LuxChartPoint, ReadingBucketedDatesRow } from "@/app/lib/readings/readings.types";

/** Desktop: room for left strip labels; mobile uses labels under axis instead. */
const MARGIN_DESKTOP = { top: 10, right: 10, bottom: 36, left: 124 };
const MARGIN_MOBILE = { top: 10, right: 12, bottom: 12, left: 12 };
/** Space below each ridge for weekday ticks + centered week label (mobile). */
const MOBILE_RIDGE_FOOTER = 45;
/** Extra vertical space between one mobile strip (ridge + footer) and the next. */
const MOBILE_RIDGE_STRIP_GAP = 8.88;
/** Tailwind `sm` breakpoint — keep in sync with `max-sm` usage. */
const MOBILE_MAX_WIDTH_PX = 639;

function useIsRidgelineMobileLayout(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`).matches,
    () => false,
  );
}
/** Drawable lux height per ridge (px). */
const bandInnerH = 78;
/** Left / under-strip week labels (single color). */
const RIDGELINE_STRIP_LABEL_FONT_PX = 8.88;
/** Vertical offset between strip baselines; larger ⇒ more space between weeks (less overlap). */
const ridgeStep = 84;
/** SE / NW outlines: tint toward page bg so ridges stay readable but not harsh. */
const ridgeStrokeSe =
  "color-mix(in srgb, var(--chart-line-secondary) 52%, var(--app-page-bg))";
const ridgeStrokeNw =
  "color-mix(in srgb, var(--chart-line) 46%, var(--app-page-bg))";
const ridgeStrokeSingle =
  "color-mix(in srgb, var(--chart-line) 48%, var(--app-page-bg))";
/**
 * Vertical offset (px) for the NW layer: same lux scale as SE, drawn lower (front) so
 * it overlaps the SE band from underneath — not cumulative lux.
 * @see https://d3-graph-gallery.com/graph/ridgeline_basic.html
 */
const RIDGE_SENSOR_SHIFT_PX = 8;

/** Thinner silhouette than the main day chart. */
const RIDGELINE_OUTLINE_STROKE_PX = Math.max(
  0.9,
  READINGS_STROKE_WIDTHS.dataLine * 0.72,
);

export type RidgelineChunkSpec = {
  /** Left label, e.g. `Mar, Week 4` (UTC, from strip start). */
  label: string;
  rows: ReadingBucketedDatesRow[];
  /** First UTC calendar day of the strip; x-axis spans `domainDaySpan` days from here. */
  domainStartDate: string;
  /**
   * UTC days on the x-axis (usually 7). May exceed how many days have `rows`; the rest of the strip is blank.
   */
  domainDaySpan: number;
};

export type LuxReadingsRidgelineChartProps = {
  chunks: RidgelineChunkSpec[];
  className?: string;
  emptyMessage?: string | null;
  /** When set, axis ticks use local noon in this zone (strip dates still UTC). */
  observerTimezone?: string;
};

type PreparedChunk = {
  label: string;
  mode: "dual" | "single";
  ridgeDual: LuxRidgeSeNwPoint[] | null;
  singlePoints: LuxChartPoint[] | null;
  xStart: Date;
  xEnd: Date;
  yMax: number;
  domainStartIso: string;
  domainDaySpan: number;
};

function ridgelineTickLabel({
  x,
  y,
  formattedValue,
}: TickRendererProps) {
  return (
    <text
      x={x}
      y={y}
      fill="var(--chart-tick)"
      fontSize={10}
      fontFamily="var(--font-sans), ui-monospace, monospace"
      textAnchor="middle"
      dominantBaseline="hanging"
    >
      {formattedValue ?? ""}
    </text>
  );
}

function LuxReadingsRidgelineChartInner({
  width,
  chunks,
  emptyMessage,
  observerTimezone,
}: {
  width: number;
  chunks: RidgelineChunkSpec[];
  emptyMessage?: string | null;
  observerTimezone?: string;
}) {
  const isMobile = useIsRidgelineMobileLayout();
  const margin = isMobile ? MARGIN_MOBILE : MARGIN_DESKTOP;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const n = chunks.length;
  const ridgePitch = isMobile
    ? bandInnerH + MOBILE_RIDGE_FOOTER + MOBILE_RIDGE_STRIP_GAP
    : ridgeStep;
  const svgHeight = isMobile
    ? margin.top + (n > 0 ? n * ridgePitch : 0) + margin.bottom
    : margin.top + (n > 0 ? (n - 1) * ridgeStep + bandInnerH : 0) + margin.bottom;

  const prepared = useMemo((): PreparedChunk[] => {
    return chunks.map((c) => {
      let xStart: Date;
      let xEnd: Date;
      try {
        xStart = getUtcDayBounds(c.domainStartDate).start;
        xEnd = getUtcDayBounds(
          utcDateAddDays(c.domainStartDate, c.domainDaySpan),
        ).start;
      } catch {
        xStart = new Date(0);
        xEnd = new Date(1);
      }

      const dualRaw = bucketedRowsToDualLuxPoints(c.rows);
      const ridgeDual =
        dualRaw && dualRaw.points.length >= 2
          ? dualLuxPointsSeBottomNwTop(dualRaw)
          : null;

      const singleRaw =
        !ridgeDual && c.rows.length > 0
          ? bucketedRowsToLuxChartPoints(c.rows)
          : null;

      let mode: "dual" | "single" = "single";
      let yMax = 1;

      if (ridgeDual && ridgeDual.length >= 2) {
        mode = "dual";
        for (const p of ridgeDual) {
          yMax = Math.max(yMax, p.luxSe, p.luxNw);
        }
      } else if (singleRaw && singleRaw.length >= 2) {
        mode = "single";
        for (const p of singleRaw) {
          yMax = Math.max(yMax, p.lux);
        }
      }

      return {
        label: c.label,
        mode,
        ridgeDual:
          ridgeDual && ridgeDual.length >= 2 ? ridgeDual : null,
        singlePoints:
          singleRaw && singleRaw.length >= 2 ? singleRaw : null,
        xStart,
        xEnd,
        yMax,
        domainStartIso: c.domainStartDate,
        domainDaySpan: c.domainDaySpan,
      };
    });
  }, [chunks]);

  const anyData = prepared.some(
    (p) =>
      (p.mode === "dual" && p.ridgeDual && p.ridgeDual.length >= 2) ||
      (p.mode === "single" && p.singlePoints && p.singlePoints.length >= 2),
  );

  if (!anyData) {
    return (
      <div
        className="flex min-h-[200px] items-center justify-center rounded-md border px-4 py-8 text-center text-sm"
        style={{
          borderColor: "var(--app-card-border)",
          color: "var(--app-text-subtle)",
        }}
      >
        {emptyMessage ?? "No multi-day bucketed data to plot yet."}
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg
        width={width}
        height={svgHeight}
        role="img"
        aria-label="Multi-day lux ridgeline chart"
      >
      <defs>
        {prepared.map((_, i) => (
          <Fragment key={`ridge-grad-${i}`}>
            <linearGradient
              id={`lux-ridge-se-${i}`}
              gradientUnits="objectBoundingBox"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="color-mix(in srgb, var(--chart-line-secondary) 34%, var(--app-card-surface))"
              />
              <stop
                offset="50%"
                stopColor="color-mix(in srgb, var(--chart-line-secondary) 14%, var(--app-page-bg))"
              />
              <stop offset="100%" stopColor="var(--app-page-bg)" />
            </linearGradient>
            <linearGradient
              id={`lux-ridge-nw-${i}`}
              gradientUnits="objectBoundingBox"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="color-mix(in srgb, var(--chart-line) 30%, var(--app-card-surface))"
              />
              <stop
                offset="50%"
                stopColor="color-mix(in srgb, var(--chart-line) 12%, var(--app-page-bg))"
              />
              <stop offset="100%" stopColor="var(--app-page-bg)" />
            </linearGradient>
            <linearGradient
              id={`lux-ridge-single-${i}`}
              gradientUnits="objectBoundingBox"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="color-mix(in srgb, var(--chart-line) 32%, var(--app-card-surface))"
              />
              <stop
                offset="50%"
                stopColor="color-mix(in srgb, var(--chart-line) 13%, var(--app-page-bg))"
              />
              <stop offset="100%" stopColor="var(--app-page-bg)" />
            </linearGradient>
          </Fragment>
        ))}
      </defs>
      {prepared.map((spec, i) => {
        const hasDual = spec.mode === "dual" && spec.ridgeDual;
        const hasSingle = spec.mode === "single" && spec.singlePoints;
        if (!hasDual && !hasSingle) return null;
        if (spec.xEnd.getTime() <= spec.xStart.getTime()) return null;

        const topY = margin.top + i * (isMobile ? ridgePitch : ridgeStep);
        const xScale = scaleUtc<number>({
          domain: [spec.xStart, spec.xEnd],
          range: [0, innerWidth],
        });

        const yScale = scaleLinear<number>({
          domain: [0, spec.yMax * 1.06 || 1],
          range: [bandInnerH, 0],
          nice: true,
        });

        const y0 = yScale(0);
        const isLast = i === n - 1;
        const showAxisOnStrip = isMobile || isLast;

        return (
          <Group key={`${spec.label}-${i}`} top={topY} left={margin.left}>
            {!isMobile ? (
              <text
                x={-margin.left + 4}
                y={bandInnerH / 2}
                fill="var(--chart-tick)"
                fontSize={RIDGELINE_STRIP_LABEL_FONT_PX}
                fontFamily="var(--font-sans), ui-monospace, monospace"
                dominantBaseline="middle"
              >
                {spec.label}
              </text>
            ) : null}

            {hasDual && spec.ridgeDual ? (
              <>
                <AreaClosed<LuxRidgeSeNwPoint>
                  data={spec.ridgeDual}
                  x={(d) => xScale(new Date(d.time)) ?? 0}
                  y={(d) => yScale(d.luxSe) ?? 0}
                  y0={() => y0}
                  yScale={yScale}
                  curve={curveStepAfter}
                  fill={`url(#lux-ridge-se-${i})`}
                />
                <LinePath<LuxRidgeSeNwPoint>
                  data={spec.ridgeDual}
                  x={(d) => xScale(new Date(d.time)) ?? 0}
                  y={(d) => yScale(d.luxSe) ?? 0}
                  curve={curveStepAfter}
                  stroke={ridgeStrokeSe}
                  strokeWidth={RIDGELINE_OUTLINE_STROKE_PX * 0.88}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
                <Group top={RIDGE_SENSOR_SHIFT_PX}>
                  <AreaClosed<LuxRidgeSeNwPoint>
                    data={spec.ridgeDual}
                    x={(d) => xScale(new Date(d.time)) ?? 0}
                    y={(d) => yScale(d.luxNw) ?? 0}
                    y0={() => y0}
                    yScale={yScale}
                    curve={curveStepAfter}
                    fill={`url(#lux-ridge-nw-${i})`}
                  />
                  <LinePath<LuxRidgeSeNwPoint>
                    data={spec.ridgeDual}
                    x={(d) => xScale(new Date(d.time)) ?? 0}
                    y={(d) => yScale(d.luxNw) ?? 0}
                    curve={curveStepAfter}
                    stroke={ridgeStrokeNw}
                    strokeWidth={RIDGELINE_OUTLINE_STROKE_PX}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fill="none"
                  />
                </Group>
              </>
            ) : hasSingle && spec.singlePoints ? (
              <>
                <AreaClosed<LuxChartPoint>
                  data={spec.singlePoints}
                  x={(d) => xScale(new Date(d.time)) ?? 0}
                  y={(d) => yScale(d.lux) ?? 0}
                  y0={() => y0}
                  yScale={yScale}
                  curve={curveStepAfter}
                  fill={`url(#lux-ridge-single-${i})`}
                />
                <LinePath<LuxChartPoint>
                  data={spec.singlePoints}
                  x={(d) => xScale(new Date(d.time)) ?? 0}
                  y={(d) => yScale(d.lux) ?? 0}
                  curve={curveStepAfter}
                  stroke={ridgeStrokeSingle}
                  strokeWidth={RIDGELINE_OUTLINE_STROKE_PX}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : null}

            {showAxisOnStrip ? (
              <AxisBottom
                top={bandInnerH}
                scale={xScale}
                hideAxisLine
                hideTicks
                tickValues={ridgelineAxisNoonInstants(
                  spec.domainStartIso,
                  spec.domainDaySpan,
                  observerTimezone,
                )}
                tickFormat={(v) =>
                  formatRidgelineAxisWeekday(v as Date, observerTimezone)
                }
                stroke="var(--chart-axis)"
                tickComponent={ridgelineTickLabel}
              />
            ) : null}
            {isMobile ? (
              <text
                x={innerWidth / 2}
                y={bandInnerH + 40}
                fill="var(--chart-tick)"
                fontSize={RIDGELINE_STRIP_LABEL_FONT_PX}
                fontFamily="var(--font-sans), ui-monospace, monospace"
                textAnchor="middle"
                dominantBaseline="hanging"
              >
                {spec.label}
              </text>
            ) : null}
          </Group>
        );
      })}
    </svg>
    </div>
  );
}

export function LuxReadingsRidgelineChart({
  chunks,
  className,
  emptyMessage,
  observerTimezone,
}: LuxReadingsRidgelineChartProps) {
  return (
    <div className={className ?? "w-full"}>
      <ParentSize>
        {({ width }) => (
          <LuxReadingsRidgelineChartInner
            width={Math.max(width, 320)}
            chunks={chunks}
            emptyMessage={emptyMessage}
            observerTimezone={observerTimezone}
          />
        )}
      </ParentSize>
    </div>
  );
}
