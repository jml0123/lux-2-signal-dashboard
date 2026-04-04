export interface ReadingDbDto {
  id: string;
  timestamp: string;
  sensor: string;
  value: number;
  resistance: number | null;
  location: string;
}

/** Serializable point for the lux chart (ISO timestamp + lux reading). */
export interface LuxChartPoint {
  time: string;
  lux: number;
}

/** Aligned buckets for two sensors (All sensors, exactly two in data). */
export interface LuxDualPoint {
  time: string;
  luxA: number;
  luxB: number;
  sensorA: string;
  sensorB: string;
}

export interface ReadingsDayParams {
  date: string;
  sensor?: string;
  location?: string;
}

/** Half-open range [start, end) for Supabase timestamp filters. */
export interface ReadingsRangeParams {
  start: Date;
  end: Date;
  sensor?: string;
  location?: string;
}

/** One row from `readings_bucketed` RPC. */
export interface ReadingBucketedRow {
  bucket_start: string;
  sensor: string;
  location: string;
  value_avg: number;
  value_min: number;
  value_max: number;
  sample_count: number;
}

/** Half-open range for `readings_bucketed` RPC (no location filter on this path). */
export interface ReadingsBucketedParams {
  start: Date;
  end: Date;
  sensor?: string;
  /** Postgres interval literal, e.g. `'1 minute'`. Default in repo. */
  stride?: string;
}

/** One row from `readings_bucketed_dates` RPC (UTC calendar `day_date`). */
export interface ReadingBucketedDatesRow extends ReadingBucketedRow {
  day_date: string;
}

/*

create table public.readings (
  id uuid not null default gen_random_uuid (),
  timestamp timestamp with time zone not null,
  sensor text not null,
  value double precision not null,
  resistance double precision null,
  location text not null,
  constraint readings_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_readings_timestamp on public.readings using btree ("timestamp" desc) TABLESPACE pg_default;

create index IF not exists idx_readings_sensor on public.readings using btree (sensor) TABLESPACE pg_default;
*/
