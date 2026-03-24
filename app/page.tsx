import { ReadingsDashboard } from "@/app/components/readings/ReadingsDashboard";
import { ReadingsDashboardHeader } from "@/app/components/readings/ReadingsDashboardHeader";
import {
  clampReadingsDateParam,
  getUtcDayChartInclusiveBounds,
} from "@/app/lib/readings/dateUtils";
import {
  getChartSunMarkersIso,
  getDawnDuskChartBounds,
  getObserverTimezone,
  getReadingsQueryBounds,
  parseObserverCoords,
  resolveObserverLocationLabel,
} from "@/app/lib/readings/sunChartBounds";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const dateRaw = firstParam(sp.date);
  const date = clampReadingsDateParam(dateRaw);
  const sensor = firstParam(sp.sensor);

  const coords = parseObserverCoords();
  const chartBounds = coords
    ? getDawnDuskChartBounds(date, coords)
    : getUtcDayChartInclusiveBounds(date);
  const queryBounds = getReadingsQueryBounds(date, chartBounds);
  const sunMarkers = coords ? getChartSunMarkersIso(date, coords) : null;
  const observerLocationLabel = await resolveObserverLocationLabel(coords);

  return (
    <div className="min-h-full flex-1 bg-[var(--app-page-bg)]">
      <div className="relative mx-auto flex w-full max-w-[min(100vw-10px,90rem)] flex-col gap-8 px-2 py-10 sm:px-3">
        <ReadingsDashboardHeader />
        <ReadingsDashboard
          chartStartIso={chartBounds.start.toISOString()}
          chartEndIso={chartBounds.end.toISOString()}
          queryStartIso={queryBounds.start.toISOString()}
          queryEndIso={queryBounds.end.toISOString()}
          date={date}
          sensor={sensor}
          sunAxisActive={Boolean(coords)}
          observerTimezone={getObserverTimezone()}
          sunMarkers={sunMarkers}
          observerLocationLabel={observerLocationLabel}
        />
      </div>
    </div>
  );
}
