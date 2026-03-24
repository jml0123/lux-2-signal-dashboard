import { NextResponse } from "next/server";
import { getReadingsBucketed } from "@/app/lib/readings/api/readings";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qStart = searchParams.get("qStart");
  const qEnd = searchParams.get("qEnd");
  const sensor = searchParams.get("sensor") ?? "";

  if (!qStart || !qEnd) {
    return NextResponse.json(
      { error: "Missing qStart or qEnd (ISO timestamps)." },
      { status: 400 },
    );
  }

  const start = new Date(qStart);
  const end = new Date(qEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "Invalid qStart or qEnd date." },
      { status: 400 },
    );
  }

  try {
    const rows = await getReadingsBucketed({
      start,
      end,
      sensor: sensor.trim() ? sensor : undefined,
    });
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
