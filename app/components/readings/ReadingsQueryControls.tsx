"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  readSensorsFromCache,
  writeSensorsToCache,
} from "@/app/lib/readings/cache/sensorsCache";

function buildQueryPath(nextDate: string, nextSensor: string) {
  const params = new URLSearchParams();
  params.set("date", nextDate);
  if (nextSensor.trim()) params.set("sensor", nextSensor);
  return `/?${params.toString()}`;
}

export type ReadingsQueryControlsProps = {
  defaultDate: string;
  defaultSensor: string;
  /** Shown next to the date field when set (IANA). */
  observerTimezone?: string;
};

export function ReadingsQueryControls({
  defaultDate,
  defaultSensor,
  observerTimezone,
}: ReadingsQueryControlsProps) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [sensor, setSensor] = useState(defaultSensor);
  /** Empty on first paint so SSR and hydration match; cache/API fill in useEffect. */
  const [sensors, setSensors] = useState<string[]>([]);
  const [sensorLoadError, setSensorLoadError] = useState<string | null>(null);

  useEffect(() => {
    setDate(defaultDate);
    setSensor(defaultSensor);
  }, [defaultDate, defaultSensor]);

  useEffect(() => {
    const cached = readSensorsFromCache();
    if (cached?.length) {
      setSensors(cached);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sensors");
        const data = (await res.json()) as { sensors?: string[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? res.statusText);
        }
        if (cancelled || !data.sensors) return;
        setSensors(data.sensors);
        writeSensorsToCache(data.sensors);
        setSensorLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setSensorLoadError(e instanceof Error ? e.message : "Failed to load sensors");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onDateChange = useCallback(
    (nextDate: string) => {
      setDate(nextDate);
      router.replace(buildQueryPath(nextDate, sensor));
    },
    [router, sensor],
  );

  const onSensorChange = useCallback(
    (nextSensor: string) => {
      setSensor(nextSensor);
      router.replace(buildQueryPath(date, nextSensor));
    },
    [router, date],
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label
        className="flex flex-col gap-1 text-sm font-medium"
        style={{ color: "var(--app-text-muted)" }}
      >
        <span className="inline-flex flex-wrap items-center gap-x-2">
          Date
          {observerTimezone ? (
            <span
              className="font-normal"
              style={{ color: "var(--app-text-subtle)" }}
            >
              ({observerTimezone})
            </span>
          ) : (
            <span
              className="font-normal"
              style={{ color: "var(--app-text-subtle)" }}
            >
              (UTC)
            </span>
          )}
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-md border px-3 py-2"
          style={{
            borderColor: "var(--app-card-border)",
            background: "var(--app-field-surface)",
            color: "var(--app-text)",
          }}
        />
      </label>
      <label
        className="flex min-w-[10rem] flex-col gap-1 text-sm font-medium"
        style={{ color: "var(--app-text-muted)" }}
      >
        Sensor
        <select
          value={sensor}
          onChange={(e) => onSensorChange(e.target.value)}
          className="rounded-md border px-3 py-2"
          style={{
            borderColor: "var(--app-card-border)",
            background: "var(--app-field-surface)",
            color: "var(--app-text)",
          }}
        >
          <option value="">All sensors</option>
          {sensors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {sensorLoadError ? (
          <span className="text-xs font-normal text-red-600 dark:text-red-400">
            {sensorLoadError}
          </span>
        ) : null}
      </label>
    </div>
  );
}
