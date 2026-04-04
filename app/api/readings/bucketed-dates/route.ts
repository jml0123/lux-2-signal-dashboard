import { NextResponse } from "next/server";
import {
  areReadingsCalendarDatesAllBeforeToday,
  isValidUtcDateParam,
} from "@/app/lib/readings/dateUtils";
import { getReadingsBucketedDates } from "@/app/lib/readings/data/readings";
import { readingsDebugLog } from "@/app/lib/readings/debugReadingsLog";
import { READINGS_DATA_EPOCH_DATE } from "@/app/lib/readings/readings.constants";
import { getObserverTimezone } from "@/app/lib/readings/sunChartBounds";

function parseDatesBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { dates?: unknown }).dates;
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string" || !isValidUtcDateParam(x)) return null;
    if (x < READINGS_DATA_EPOCH_DATE) return null;
    out.push(x);
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with { dates: string[] }." },
      { status: 400 },
    );
  }

  const dates = parseDatesBody(json);
  if (!dates) {
    return NextResponse.json(
      {
        error:
          "Invalid dates: expect unique YYYY-MM-DD strings on or after READINGS_DATA_EPOCH_DATE.",
      },
      { status: 400 },
    );
  }

  if (dates.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const observerTimezone = getObserverTimezone();

  try {
    const rows = await getReadingsBucketedDates(dates);
    const first = rows[0];
    const last = rows.length > 0 ? rows[rows.length - 1] : undefined;
    readingsDebugLog("bucketed-dates", {
      dates,
      rowCount: rows.length,
      firstBucket: first?.bucket_start ?? null,
      lastBucket: last?.bucket_start ?? null,
    });

    const headers = new Headers();
    if (areReadingsCalendarDatesAllBeforeToday(dates, observerTimezone)) {
      headers.set(
        "Cache-Control",
        "public, max-age=31536000, s-maxage=31536000, immutable",
      );
    }

    return NextResponse.json({ rows }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
