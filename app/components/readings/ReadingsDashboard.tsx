"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuxReadingsSingleChart } from "@/app/components/charts/lux-readings/LuxReadingsSingleChart";
import { ReadingsQueryControls } from "@/app/components/readings/ReadingsQueryControls";
import type { ReadingsQueryControlsHandle } from "@/app/components/readings/ReadingsQueryControls";
import {
  bucketedRowsToDualLuxPoints,
  bucketedRowsToLuxChartPoints,
} from "@/app/lib/readings/data/readings";
import {
  readReadingsFromCache,
  readingsCacheKey,
  writeReadingsToCache,
} from "@/app/lib/readings/cache/readingsCache";
import { ReadingsScopeSelector } from "@/app/components/readings/ReadingsScopeSelector";
import { ReadingsSensorSelect } from "@/app/components/readings/ReadingsSensorSelect";
import { formatChartDayTitleParts } from "@/app/lib/readings/dateUtils";
import type { ChartSunMarkersIso } from "@/app/lib/readings/sunChartBounds";
import type {
  LuxChartPoint,
  ReadingBucketedRow,
} from "@/app/lib/readings/readings.types";

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

  const chartDayTitle = useMemo(
    () => formatChartDayTitleParts(date, observerTimezone),
    [date, observerTimezone],
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

  useEffect(() => {
    const key = readingsCacheKey(date, sensor, queryStartIso, queryEndIso);
    const cached = readReadingsFromCache(key);
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
  }, [date, sensor, queryStartIso, queryEndIso]);

  return (
    <>
      <div className="flex justify-center">
        <ReadingsScopeSelector />
      </div>
      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : null}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--app-text-subtle)" }}>
          Loading readings…
        </p>
      ) : null}
      {!loading && pointCount === 0 ? (
        <p className="text-sm" style={{ color: "var(--app-text-subtle)" }}>
          No readings in the loaded window for the current filters. The chart still shows
          the full axis so you can see when data will appear.
        </p>
      ) : null}
      {!loading && pointCount === 1 ? (
        <p className="text-sm" style={{ color: "var(--app-text-subtle)" }}>
          One bucket loaded; at least two are needed to draw the series.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 px-1 pt-4 pb-0 sm:px-2">
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
        />
      </div>
      <div className="-mt-6 flex justify-end px-1 sm:px-2">
        <div className="flex flex-col items-end gap-2">
          {chartDayTitle ? (
            <div className="font-display text-right text-sm leading-tight">
            <h2 className="flex flex-wrap items-center justify-end gap-x-2">
              <span
                className="font-normal tracking-tight"
              >
                <button
                  type="button"
                  onClick={() => queryControlsRef.current?.openDatePicker()}
                  className="group inline-flex cursor-pointer items-center gap-0.5 underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                  style={{ color: "var(--chart-title-date)" }}
                  aria-label="Open date picker"
                >
                  {chartDayTitle.dateLine}
                  <svg
                    className="shrink-0 opacity-45 transition-opacity group-hover:opacity-70"
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    aria-hidden
                  >
                    <path
                      d="M2.5 4.25L6 7.75L9.5 4.25"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
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
          ) : null}
          <ReadingsQueryControls
            ref={queryControlsRef}
            defaultDate={date}
            defaultSensor={sensor}
            observerTimezone={observerTimezone}
          />
        </div>
      </div>
    </>
  );
}
