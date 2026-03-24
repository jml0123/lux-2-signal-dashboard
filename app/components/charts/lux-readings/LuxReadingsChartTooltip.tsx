import type { ChartTooltipData } from "@/app/components/charts/charts.types";

export function LuxReadingsChartTooltipContent({
  data,
  formatTimeLabel,
}: {
  data: ChartTooltipData;
  formatTimeLabel: (iso: string) => string;
}) {
  if (data.kind === "single") {
    return (
      <div className="flex flex-col gap-0.5">
        <div>{formatTimeLabel(data.point.time)}</div>
        <div className="font-medium tabular-nums">
          {Math.round(data.point.lux)} lux
        </div>
      </div>
    );
  }
  if (data.kind === "dual") {
    return (
      <div className="flex flex-col gap-1">
        <div>{formatTimeLabel(data.point.time)}</div>
        <div className="tabular-nums">
          <span style={{ color: "var(--palette-celadon)" }}>
            {data.point.sensorA}:
          </span>{" "}
          {Math.round(data.point.luxA)} lux
        </div>
        <div className="tabular-nums">
          <span style={{ color: "var(--palette-sea-green)" }}>
            {data.point.sensorB}:
          </span>{" "}
          {Math.round(data.point.luxB)} lux
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="font-semibold">{data.label}</div>
      <div className="tabular-nums opacity-90">{data.timeLabel}</div>
    </div>
  );
}
