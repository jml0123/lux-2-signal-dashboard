
export interface GetReadingRequest {
    timestamps: Date[];
    location: string;
}

export interface ReadingDbDto {
    id: string;
    timestamp: string;
    sensor: string;
    value: number;
    resistance: number | null;
    location: string;
}

export interface PlotData {
    x: string;
    y: number;
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