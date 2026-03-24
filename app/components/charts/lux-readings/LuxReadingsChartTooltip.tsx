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
        <div style={{ color: "var(--chart-tooltip-fg)" }}>
          {formatTimeLabel(data.point.time)}
        </div>
        <div
          className="font-medium tabular-nums"
          style={{ color: "var(--chart-line)" }}
        >
          {Math.round(data.point.lux)} lux
        </div>
      </div>
    );
  }
  if (data.kind === "dual") {
    return (
      <div className="flex flex-col gap-1">
        <div style={{ color: "var(--chart-tooltip-fg)" }}>
          {formatTimeLabel(data.point.time)}
        </div>
        <div
          className="tabular-nums"
          style={{ color: "var(--chart-line)" }}
        >
          <span className="font-medium">{data.point.sensorA}:</span>{" "}
          {Math.round(data.point.luxA)} lux
        </div>
        <div
          className="tabular-nums"
          style={{ color: "var(--chart-line-secondary)" }}
        >
          <span className="font-medium">{data.point.sensorB}:</span>{" "}
          {Math.round(data.point.luxB)} lux
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="font-semibold" style={{ color: "var(--ethereal-pearl-blue)" }}>
        {data.label}
      </div>
      <div
        className="tabular-nums"
        style={{ color: "var(--chart-tooltip-fg)" }}
      >
        {data.timeLabel}
      </div>
    </div>
  );
}
