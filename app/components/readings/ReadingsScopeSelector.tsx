"use client";

import { useRouter } from "next/navigation";
import {
  buildMultidayQueryPath,
  buildReadingsQueryPath,
  type ReadingsScopeTab,
} from "@/app/lib/readings/readingsQueryPath";

export type ReadingsScopeSelectorProps = {
  anchorDate: string;
  sensor: string;
  activeScope: ReadingsScopeTab;
};

export function ReadingsScopeSelector({
  anchorDate,
  sensor,
  activeScope,
}: ReadingsScopeSelectorProps) {
  const router = useRouter();

  const go = (scope: ReadingsScopeTab) => {
    if (scope === "multi") {
      router.replace(buildMultidayQueryPath(sensor, undefined, anchorDate));
      return;
    }
    router.replace(buildReadingsQueryPath(anchorDate, sensor));
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="lux-scope-segment flex w-fit flex-wrap gap-px rounded-md border p-0.5 shadow-sm"
        style={{
          borderColor: "var(--app-card-border)",
          background: "var(--app-card-surface)",
        }}
        role="group"
        aria-label="Readings scope"
      >
        <button
          type="button"
          onClick={() => go("day")}
          className="rounded-sm px-2 py-1 text-xs font-semibold leading-tight transition-colors"
          style={{
            background:
              activeScope === "day"
                ? "var(--app-page-bg-accent)"
                : "transparent",
            color: "var(--chart-title-date)",
          }}
          aria-pressed={activeScope === "day"}
        >
          Day
        </button>
        <button
          type="button"
          onClick={() => go("multi")}
          className="rounded-sm px-2 py-1 text-xs font-semibold leading-tight transition-colors"
          style={{
            background:
              activeScope === "multi"
                ? "var(--app-page-bg-accent)"
                : "transparent",
            color: "var(--chart-title-date)",
          }}
          aria-pressed={activeScope === "multi"}
        >
          Multi-day
        </button>
      </div>
    </div>
  );
}
