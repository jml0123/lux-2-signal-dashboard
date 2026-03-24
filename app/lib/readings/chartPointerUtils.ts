import type { LuxChartPoint, LuxDualPoint } from "@/app/lib/readings/readings.types";

export function formatXTick(v: Date | number) {
  const d = v instanceof Date ? v : new Date(v);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatTimeLabel(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function nearestLuxPoint(
  points: LuxChartPoint[],
  tMs: number,
): LuxChartPoint | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.abs(new Date(p.time).getTime() - tMs);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function nearestDualPoint(
  points: LuxDualPoint[],
  tMs: number,
): LuxDualPoint | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.abs(new Date(p.time).getTime() - tMs);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
