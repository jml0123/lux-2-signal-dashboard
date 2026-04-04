import { redirect } from "next/navigation";
import { ReadingsDashboardHeader } from "@/app/components/readings/ReadingsDashboardHeader";
import { ReadingsMultiDayDashboard } from "@/app/components/readings/ReadingsMultiDayDashboard";
import { clampReadingsDateParam } from "@/app/lib/readings/dateUtils";
import {
  multiWindowLatestUtcDate,
  resolveMdWinParam,
} from "@/app/lib/readings/multiWeekWindow";
import { buildMultidayQueryPath } from "@/app/lib/readings/readingsQueryPath";
import { READINGS_DATA_EPOCH_DATE } from "@/app/lib/readings/readings.constants";
import { getObserverTimezone } from "@/app/lib/readings/sunChartBounds";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function MultidayPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const endWeekRaw = firstParam(sp.endWeek);
  const sensor = firstParam(sp.sensor);
  const dateRaw = firstParam(sp.date);
  const dayReturn = dateRaw.trim() ? clampReadingsDateParam(dateRaw) : null;
  const latestUtc = multiWindowLatestUtcDate();
  const resolved = resolveMdWinParam(
    endWeekRaw || undefined,
    READINGS_DATA_EPOCH_DATE,
    latestUtc,
  );

  if (resolved) {
    const normalized = endWeekRaw.trim();
    if (!normalized || normalized !== resolved) {
      redirect(buildMultidayQueryPath(sensor, resolved, dayReturn ?? undefined));
    }
  }

  return (
    <div className="min-h-full flex-1 bg-[var(--app-page-bg)]">
      <div className="relative mx-auto flex w-full max-w-[min(100vw-10px,90rem)] flex-col gap-8 px-2 py-10 sm:px-3">
        <ReadingsDashboardHeader />
        <ReadingsMultiDayDashboard
          endWeek={resolved}
          sensor={sensor}
          dayReturn={dayReturn}
          observerTimezone={getObserverTimezone()}
        />
      </div>
    </div>
  );
}
