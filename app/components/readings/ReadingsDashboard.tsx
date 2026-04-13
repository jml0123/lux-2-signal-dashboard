"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuxReadingsSingleChart } from "@/app/components/charts/lux-readings/LuxReadingsSingleChart";
import { ReadingsQueryControls } from "@/app/components/readings/ReadingsQueryControls";
import type { ReadingsQueryControlsHandle } from "@/app/components/readings/ReadingsQueryControls";
import {
  bucketedRowsToDualLuxPoints,
  bucketedRowsToLuxChartPoints,
  buildLuxTimelineForAmbient,
} from "@/app/lib/readings/data/readings";
import {
  readReadingsFromCache,
  readingsCacheKey,
  writeReadingsToCache,
} from "@/app/lib/readings/cache/readingsCache";
import { ReadingsControlChevronIcon } from "@/app/components/readings/ReadingsControlChevronIcon";
import { ReadingsScopeSelector } from "@/app/components/readings/ReadingsScopeSelector";
import { ReadingsSensorSelect } from "@/app/components/readings/ReadingsSensorSelect";
import {
  formatChartDayTitleParts,
  isCompleteHistoricalReadingsDay,
} from "@/app/lib/readings/dateUtils";
import { buildAmbientTimeKnots } from "@/app/lib/readings/ambientLightScrub";
import { useAnimatedAmbientScrubGradient } from "@/app/lib/readings/useAnimatedAmbientScrubGradient";
import type { ChartSunMarkersIso } from "@/app/lib/readings/sunChartBounds";
import type {
  LuxChartPoint,
  ReadingBucketedRow,
} from "@/app/lib/readings/readings.types";

const FUTURE_DATA_MESSAGE =
  "No data has been collected for this day yet (the sun has not yet risen yet, or it may be the future...) Check back again later!";
const NO_DATA_MESSAGE =
  "No data has been collected for this day. There may have been an error in the system preventing data collection, try a different day!";

export type ReadingsDashboardProps = {
  chartStartIso: string;
  chartEndIso: string;
  queryStartIso: string;
  queryEndIso: string;
  date: string;
  sensor: string;
  sunAxisActive: boolean;
  observerTimezone?: string;
  sunMarkers: ChartSunMarkersIso | null;
  observerLocationLabel?: string | null;
};

export function ReadingsDashboard({
  chartStartIso,
  chartEndIso,
  queryStartIso,
  queryEndIso,
  date,
  sensor,
  observerTimezone,
  sunMarkers,
  observerLocationLabel,
}: ReadingsDashboardProps) {
  const queryControlsRef = useRef<ReadingsQueryControlsHandle | null>(null);
  const [rows, setRows] = useState<ReadingBucketedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isHistorical = isCompleteHistoricalReadingsDay(date, observerTimezone);
  const emptyMessage = isHistorical
    ? NO_DATA_MESSAGE
    : FUTURE_DATA_MESSAGE;
  const ambientKnots = useMemo(
    () =>
      buildAmbientTimeKnots(
        new Date(chartStartIso).getTime(),
        new Date(chartEndIso).getTime(),
        sunMarkers,
      ),
    [chartStartIso, chartEndIso, sunMarkers],
  );

  const { points, dual, pointCount } = useMemo(() => {
    const d = !sensor.trim() ? bucketedRowsToDualLuxPoints(rows) : null;
    if (d) {
      return {
        points: [] as LuxChartPoint[],
        dual: d,
        pointCount: d.points.length,
      };
    }
    const pts = bucketedRowsToLuxChartPoints(rows);
    return { points: pts, dual: undefined, pointCount: pts.length };
  }, [rows, sensor]);

  const luxTimeline = useMemo(() => buildLuxTimelineForAmbient(rows), [rows]);

  const { overlayGradientCss, onAmbientScrubTime } = useAnimatedAmbientScrubGradient({
    ambientKnots,
    luxTimeline,
    resetDeps: [date, chartStartIso, chartEndIso],
  });

  const chartDayTitle = useMemo(
    () => formatChartDayTitleParts(date, observerTimezone),
    [date, observerTimezone],
  );

  useEffect(() => {
    const key = readingsCacheKey(date, sensor, queryStartIso, queryEndIso);
    const cached = readReadingsFromCache(key, date, observerTimezone);
    if (cached) {
      setRows(cached);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setRows([]);
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const params = new URLSearchParams({
          qStart: queryStartIso,
          qEnd: queryEndIso,
        });
        if (sensor.trim()) params.set("sensor", sensor.trim());
        const res = await fetch(`/api/readings/bucketed?${params}`);
        const data = (await res.json()) as {
          rows?: ReadingBucketedRow[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? res.statusText);
        }
        const nextRows = data.rows ?? [];
        if (cancelled) return;
        setRows(nextRows);
        writeReadingsToCache(key, nextRows);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load readings",
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, sensor, queryStartIso, queryEndIso, observerTimezone]);

  return (
    <>
      <div className="relative z-[1]">
      <div className="flex justify-center">
        <ReadingsScopeSelector
          anchorDate={date}
          sensor={sensor}
          activeScope="day"
        />
      </div>
      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : null}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--app-text-subtle)" }}>
          Loading readings…
        </p>
      ) : null}
      {!loading && pointCount === 1 ? (
        <p className="text-sm" style={{ color: "var(--app-text-subtle)" }}>
          One bucket loaded; at least two are needed to draw the series.
        </p>
      ) : null}
      <div className="relative z-0 flex flex-col gap-2 px-1 pt-4 pb-0 sm:px-2">
        <ReadingsSensorSelect
          defaultDate={date}
          defaultSensor={sensor}
          className="self-start"
        />
        <LuxReadingsSingleChart
          key={`${chartStartIso}|${chartEndIso}|${date}|${sensor}`}
          chartDayTitle={null}
          observerLocationLabel={null}
          dayStartIso={chartStartIso}
          dayEndIso={chartEndIso}
          points={points}
          dual={dual}
          sunMarkers={sunMarkers}
          onAmbientScrubTime={onAmbientScrubTime}
          emptyPlotMessage={
            !loading && pointCount === 0
              ? emptyMessage
              : null
          }
        />
      </div>
      <div className="relative z-10 -mt-6 flex justify-end px-1 sm:px-2">
        <div className="flex flex-col items-end gap-2">
          {chartDayTitle ? (
            <div className="text-right text-sm leading-tight">
            <h2 className="lux-masthead-datetime w-full">
              <button
                type="button"
                onClick={() => queryControlsRef.current?.openDatePicker()}
                aria-label="Open date picker"
                className="group flex w-full cursor-pointer flex-wrap items-center justify-end gap-x-2 border-0 bg-transparent p-0 font-[inherit]"
              >
                <span
                  className="inline-flex items-center gap-0.5 font-semibold tracking-tight underline decoration-transparent underline-offset-2 transition-colors group-hover:decoration-current"
                  style={{ color: "var(--chart-title-date)" }}
                >
                  {chartDayTitle.dateLine}
                  <ReadingsControlChevronIcon className="shrink-0 opacity-45 transition-opacity group-hover:opacity-70" />
                </span>
                {chartDayTitle.weekdayLine ? (
                  <span
                    className="font-bold tracking-tight"
                    style={{
                      color: "var(--chart-title-weekday)",
                    }}
                  >
                    {chartDayTitle.weekdayLine}
                  </span>
                ) : null}
              </button>
            </h2>
            {observerLocationLabel ? (
              <div
                className="lux-masthead-location mt-0.5 font-normal tracking-tight"
                style={{
                  color: "var(--chart-title-weekday)",
                  opacity: 0.74,
                }}
              >
                {observerLocationLabel}
              </div>
            ) : null}
            </div>
          ) : null}
          <ReadingsQueryControls
            ref={queryControlsRef}
            defaultDate={date}
            defaultSensor={sensor}
            observerTimezone={observerTimezone}
          />
        </div>
      </div>
      </div>
      {overlayGradientCss ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            backgroundImage: `linear-gradient(var(--ambient-scrub-wash), var(--ambient-scrub-wash)), ${overlayGradientCss}`,
          }}
        />
      ) : null}
    </>
  );
}
