import { ReadingsDashboard } from "@/app/components/readings/ReadingsDashboard";
import {
  defaultDashboardDateString,
  getUtcDayChartInclusiveBounds,
  isValidUtcDateParam,
} from "@/app/lib/readings/dayBounds";
import {
  getChartSunMarkersIso,
  getDawnDuskChartBounds,
  getObserverTimezone,
  getReadingsQueryBounds,
  parseObserverCoords,
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
  const date = isValidUtcDateParam(dateRaw)
    ? dateRaw
    : defaultDashboardDateString();
  const sensor = firstParam(sp.sensor);

  const coords = parseObserverCoords();
  const chartBounds = coords
    ? getDawnDuskChartBounds(date, coords)
    : getUtcDayChartInclusiveBounds(date);
  const queryBounds = getReadingsQueryBounds(date, chartBounds);
  const sunMarkers = coords ? getChartSunMarkersIso(date, coords) : null;

  return (
    <div className="min-h-full flex-1 bg-[var(--app-page-bg)]">
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
      />
    </div>
  );
}
