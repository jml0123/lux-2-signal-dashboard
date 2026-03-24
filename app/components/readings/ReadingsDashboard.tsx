"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuxReadingsChart } from "@/app/components/charts/LuxReadingsChart";
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
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import { formatChartDayTitleParts } from "@/app/lib/readings/formatChartDayTitle";
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
        <h1
          className="font-display text-xl font-bold tracking-[-0.02em] sm:text-2xl"
          style={{ color: "var(--chart-title-date)" }}
        >
          Light Readings
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--app-text-subtle)" }}
        >
        </p>
        </div>
        <ThemeToggle />
      </header>
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
      <div className="px-4 pt-4 pb-0">
        <LuxReadingsChart
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
      <div className="-mt-6 flex justify-end px-4">
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
                  className="cursor-pointer underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                  style={{ color: "var(--chart-title-date)" }}
                  aria-label="Open date picker"
                >
                  {chartDayTitle.dateLine}
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
    </div>
  );
}
