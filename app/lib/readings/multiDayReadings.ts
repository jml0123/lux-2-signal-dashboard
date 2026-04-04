/** Non-overlapping slices of `windowDays` each (chronological order). */
export function chunkDateList<T>(dates: T[], windowDays: number): T[][] {
  if (windowDays <= 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < dates.length; i += windowDays) {
    chunks.push(dates.slice(i, i + windowDays));
  }
  return chunks;
}
