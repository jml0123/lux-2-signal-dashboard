"use client";

import { useEffect, useMemo, useState } from "react";
import { LuxReadingsChart } from "@/app/components/charts/LuxReadingsChart";
import { ReadingsQueryControls } from "@/app/components/readings/ReadingsQueryControls";
import {
  bucketedRowsToDualLuxPoints,
  bucketedRowsToLuxChartPoints,
} from "@/app/lib/readings/api/readings";
import {
  readReadingsFromCache,
  readingsCacheKey,
  writeReadingsToCache,
} from "@/app/lib/readings/cache/readingsCache";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import { formatChartDayTitle } from "@/app/lib/readings/formatChartDayTitle";
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
};

export function ReadingsDashboard({
  chartStartIso,
  chartEndIso,
  queryStartIso,
  queryEndIso,
  date,
  sensor,
  sunAxisActive,
  observerTimezone,
  sunMarkers,
}: ReadingsDashboardProps) {
  const [rows, setRows] = useState<ReadingBucketedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const axisDescription = sunAxisActive
    ? "Horizontal axis: 30 minutes before civil dawn through 30 minutes after civil dusk at OBSERVER_LAT / OBSERVER_LNG (same site as the sensors)."
    : "Set OBSERVER_LAT and OBSERVER_LNG to use civil dawn/dusk windowing; otherwise the axis is the UTC calendar day.";

  const chartDayTitle = useMemo(
    () => formatChartDayTitle(date, observerTimezone),
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
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "var(--app-text)" }}
        >
          Lux readings
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--app-text-subtle)" }}
        >
          {axisDescription}
          {observerTimezone
            ? ` Civil date uses time zone ${observerTimezone}.`
            : null}
          {dual ? (
            <>
              {" "}
              All sensors: shaded band spans{" "}
              <span
                className="font-medium"
                style={{ color: "var(--app-text-muted)" }}
              >
                {dual.sensorA}
              </span>{" "}
              and{" "}
              <span
                className="font-medium"
                style={{ color: "var(--app-text-muted)" }}
              >
                {dual.sensorB}
              </span>
              . Brush the strip below to zoom the time axis.
            </>
          ) : (
            <>
              {" "}
              Hover for values; brush the strip below to zoom. Pick one sensor unless
              you have exactly two for the dual-sensor view.
            </>
          )}
        </p>
        </div>
        <ThemeToggle />
      </header>
      <ReadingsQueryControls
        defaultDate={date}
        defaultSensor={sensor}
        observerTimezone={observerTimezone}
      />
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
      <div className="p-4">
        <LuxReadingsChart
          key={`${chartStartIso}|${chartEndIso}|${date}|${sensor}`}
          dayTitle={chartDayTitle}
          dayStartIso={chartStartIso}
          dayEndIso={chartEndIso}
          points={points}
          dual={dual}
          sunMarkers={sunMarkers}
        />
      </div>
    </div>
  );
}
