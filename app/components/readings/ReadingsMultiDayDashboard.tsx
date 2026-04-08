"use client";

import { useEffect, useMemo, useState } from "react";
import { LuxReadingsRidgelineChart } from "@/app/components/charts/lux-readings/LuxReadingsRidgelineChart";
import type { RidgelineChunkSpec } from "@/app/components/charts/lux-readings/LuxReadingsRidgelineChart";
import { bucketedDatesRowsByDay } from "@/app/lib/readings/data/readings";
import {
  readReadingsDatesFromCache,
  readingsDatesCacheKey,
  writeReadingsDatesToCache,
} from "@/app/lib/readings/cache/readingsDatesCache";
import {
  MULTI_STRIP_DAYS,
  multiWindowDatesForMdWinClamped,
  multiWindowLatestUtcDate,
  ridgelineStripLabelsForChunks,
} from "@/app/lib/readings/multiWeekWindow";
import { READINGS_DATA_EPOCH_DATE } from "@/app/lib/readings/readings.constants";
import { ReadingsMultiWeekForm } from "@/app/components/readings/ReadingsMultiWeekForm";
import { ReadingsScopeSelector } from "@/app/components/readings/ReadingsScopeSelector";
import { chunkDateList } from "@/app/lib/readings/multiDayReadings";
import type { ReadingBucketedDatesRow } from "@/app/lib/readings/readings.types";

export type ReadingsMultiDayDashboardProps = {
  endWeek: string | null;
  sensor: string;
  /** Day-view `date` preserved in the multiday URL; used when switching back to Day. */
  dayReturn?: string | null;
  observerTimezone?: string;
};

function concatRowsForDates(
  byDay: Map<string, ReadingBucketedDatesRow[]>,
  dates: string[],
): ReadingBucketedDatesRow[] {
  const out: ReadingBucketedDatesRow[] = [];
  for (const d of dates) {
    const rows = byDay.get(d);
    if (rows?.length) out.push(...rows);
  }
  return out;
}

export function ReadingsMultiDayDashboard({
  endWeek,
  sensor,
  dayReturn,
  observerTimezone,
}: ReadingsMultiDayDashboardProps) {
  const [byDay, setByDay] = useState<Map<string, ReadingBucketedDatesRow[]>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const latestUtc = multiWindowLatestUtcDate();

  const datesNeeded = useMemo(() => {
    if (!endWeek) return [];
    return (
      multiWindowDatesForMdWinClamped(
        endWeek,
        READINGS_DATA_EPOCH_DATE,
        latestUtc,
      ) ?? []
    );
  }, [endWeek, latestUtc]);

  const dateChunks = useMemo(
    () => chunkDateList(datesNeeded, MULTI_STRIP_DAYS),
    [datesNeeded],
  );

  const ridgelineStripLabels = useMemo(
    () => ridgelineStripLabelsForChunks(dateChunks),
    [dateChunks],
  );

  useEffect(() => {
    const nextMap = new Map<string, ReadingBucketedDatesRow[]>();
    const missing: string[] = [];

    if (datesNeeded.length === 0) {
      setByDay(nextMap);
      setLoadError(null);
      setLoading(false);
      return;
    }

    for (const d of datesNeeded) {
      const key = readingsDatesCacheKey(d);
      const cached = readReadingsDatesFromCache(key, d, observerTimezone);
      if (cached?.length) {
        nextMap.set(d, cached);
      } else {
        missing.push(d);
      }
    }

    setByDay(nextMap);

    if (missing.length === 0) {
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const res = await fetch("/api/readings/bucketed-dates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: missing }),
        });
        const data = (await res.json()) as {
          rows?: ReadingBucketedDatesRow[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? res.statusText);
        }
        const rows = data.rows ?? [];
        const split = bucketedDatesRowsByDay(rows);

        if (cancelled) return;

        setByDay((prev) => {
          const merged = new Map(prev);
          for (const d of missing) {
            const got = split.get(d) ?? [];
            merged.set(d, got);
            writeReadingsDatesToCache(readingsDatesCacheKey(d), got);
          }
          return merged;
        });
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load readings",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [datesNeeded, observerTimezone]);

  const ridgelineChunks: RidgelineChunkSpec[] = useMemo(() => {
    return dateChunks
      .map((chunkDates, i) => {
        if (chunkDates.length === 0) return null;
        const oldest = chunkDates[0] ?? "";
        const label = ridgelineStripLabels[i] ?? "";
        return {
          label,
          rows: concatRowsForDates(byDay, chunkDates),
          domainStartDate: oldest,
          /** Full strip width (7 days); partial weeks show empty tail with correct weekday ticks. */
          domainDaySpan: MULTI_STRIP_DAYS,
        };
      })
      .filter((row): row is RidgelineChunkSpec => row != null);
  }, [byDay, dateChunks, ridgelineStripLabels]);

  return (
    <>
      <div className="relative z-[1]">
        <div className="flex justify-center">
          <ReadingsScopeSelector
            anchorDate={
              dayReturn?.trim()
                ? dayReturn.trim()
                : datesNeeded.length > 0
                  ? datesNeeded[datesNeeded.length - 1]!
                  : multiWindowLatestUtcDate()
            }
            sensor={sensor}
            activeScope="multi"
          />
        </div>
        {loadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        ) : null}
        <div className="relative z-0 flex w-full min-w-0 flex-col gap-3 px-1 pt-4 max-sm:mb-32 sm:mb-24 sm:px-2">
          <LuxReadingsRidgelineChart
            chunks={ridgelineChunks}
            observerTimezone={observerTimezone}
            className="min-h-[300px] w-full max-sm:px-1"
            emptyMessage={
              !endWeek
                ? "No week window in range yet."
                : loading && datesNeeded.length > 0
                  ? "Loading multi-day readings…"
                  : !loading
                    ? "No data in range yet, or not enough buckets to draw a line."
                    : null
            }
          />
        </div>
        <div className="relative z-10 flex shrink-0 flex-col items-center px-1 sm:px-2">
          <ReadingsMultiWeekForm
            currentEndWeek={endWeek}
            sensor={sensor}
            dayReturn={dayReturn}
          />
        </div>
      </div>
    </>
  );
}
