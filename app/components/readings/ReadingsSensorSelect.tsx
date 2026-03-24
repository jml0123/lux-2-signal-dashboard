"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  readSensorsFromCache,
  writeSensorsToCache,
} from "@/app/lib/readings/cache/sensorsCache";
import { buildReadingsQueryPath } from "@/app/lib/readings/readingsQueryPath";

export type ReadingsSensorSelectProps = {
  defaultDate: string;
  defaultSensor: string;
  className?: string;
};

export function ReadingsSensorSelect({
  defaultDate,
  defaultSensor,
  className,
}: ReadingsSensorSelectProps) {
  const router = useRouter();
  const [sensor, setSensor] = useState(defaultSensor);
  const [sensors, setSensors] = useState<string[]>([]);
  const [sensorLoadError, setSensorLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSensor(defaultSensor);
  }, [defaultSensor]);

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
          setSensorLoadError(
            e instanceof Error ? e.message : "Failed to load sensors",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSensorChange = useCallback(
    (nextSensor: string) => {
      setSensor(nextSensor);
      router.replace(buildReadingsQueryPath(defaultDate, nextSensor));
    },
    [router, defaultDate],
  );

  return (
    <div className={className}>
      <label
        className="flex min-w-[8rem] flex-col gap-1"
        style={{ color: "var(--app-text-muted)" }}
      >
        <span className="sr-only">Sensor</span>
        <select
          value={sensor}
          onChange={(e) => onSensorChange(e.target.value)}
          aria-label="Sensor"
          className="rounded-none border px-2 py-1 text-xs"
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
          <span className="max-w-[12rem] text-xs font-normal text-red-600 dark:text-red-400">
            {sensorLoadError}
          </span>
        ) : null}
      </label>
    </div>
  );
}
