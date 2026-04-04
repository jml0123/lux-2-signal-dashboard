import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";

function throwPostgrest(prefix: string, error: PostgrestError): never {
  const bits = [`${prefix}: ${error.message}`];
  if (error.code) bits.push(`code=${error.code}`);
  if (error.details) bits.push(`details=${error.details}`);
  if (error.hint) bits.push(`hint=${error.hint}`);
  throw new Error(bits.join(" | "));
}
import { getUtcDayBounds } from "../dateUtils";
import { MULTI_DAY_BUCKET_STRIDE } from "../readings.constants";
import type {
  ReadingBucketedDatesRow,
  ReadingBucketedRow,
  ReadingDbDto,
  ReadingsBucketedParams,
  ReadingsDayParams,
  ReadingsRangeParams,
} from "../readings.types";

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY must be set",
      );
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

const DEFAULT_BUCKET_STRIDE = "1 minute";

/**
 * Chart path: `readings_bucketed` RPC (small payload). When no sensor filter, rows for
 * multiple sensors are returned; merge in the mapper using sample_count weights.
 */
export async function getReadingsBucketed(
  params: ReadingsBucketedParams,
): Promise<ReadingBucketedRow[]> {
  const stride = params.stride ?? DEFAULT_BUCKET_STRIDE;
  const { data, error } = await getSupabase().rpc("readings_bucketed", {
    p_start: params.start.toISOString(),
    p_end: params.end.toISOString(),
    p_stride: stride,
    p_sensor: params.sensor?.trim() ? params.sensor : null,
    p_location: null,
  });
  if (error) {
    throwPostgrest("readings_bucketed RPC", error);
  }
  return (data ?? []) as ReadingBucketedRow[];
}

/**
 * Multi-day path: `readings_bucketed_dates` with UTC calendar days and fixed stride.
 * Empty `dates` skips the network call.
 */
export async function getReadingsBucketedDates(
  dates: string[],
): Promise<ReadingBucketedDatesRow[]> {
  if (dates.length === 0) return [];
  const { data, error } = await getSupabase().rpc("readings_bucketed_dates", {
    p_dates: dates,
    p_stride: MULTI_DAY_BUCKET_STRIDE,
  });
  if (error) {
    throwPostgrest("readings_bucketed_dates RPC", error);
  }
  return (data ?? []) as ReadingBucketedDatesRow[];
}

/** Half-open range [start, end) on `timestamp`. Row cap comes from your Supabase API max rows. */
export async function getReadingsForTimeRange(
  params: ReadingsRangeParams,
): Promise<ReadingDbDto[]> {
  let q = getSupabase()
    .from("readings")
    .select("*")
    .gte("timestamp", params.start.toISOString())
    .lt("timestamp", params.end.toISOString())
    .order("timestamp", { ascending: true });

  if (params.sensor) {
    q = q.eq("sensor", params.sensor);
  }
  if (params.location) {
    q = q.eq("location", params.location);
  }

  const { data, error } = await q;
  if (error) {
    throwPostgrest("readings select", error);
  }
  return data ?? [];
}

/** UTC calendar day only; prefer getReadingsForTimeRange + dawn/dusk merge for dashboards. */
export async function getReadingsForCalendarDay(
  params: ReadingsDayParams,
): Promise<ReadingDbDto[]> {
  const { start, end } = getUtcDayBounds(params.date);
  return getReadingsForTimeRange({
    start,
    end,
    sensor: params.sensor,
    location: params.location,
  });
}

export async function getSensorNamesSupabase(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("sensor_list")
    .select("sensor");
  if (error) {
    throwPostgrest("sensor_list select", error);
  }
  return (data ?? []).map((row: { sensor: string }) => row.sensor);
}
