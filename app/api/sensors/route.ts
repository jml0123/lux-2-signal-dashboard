import { NextResponse } from "next/server";
import { fetchSensorNames } from "@/app/lib/readings/data/sensors";

export async function GET() {
  try {
    const sensors = await fetchSensorNames();
    return NextResponse.json({ sensors });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
