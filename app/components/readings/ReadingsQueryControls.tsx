"use client";

import { Calendar } from "primereact/calendar";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
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

export type ReadingsQueryControlsHandle = {
  openDatePicker: () => void;
};

function toDateValue(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toDateParam(dateValue: Date): string {
  const y = dateValue.getFullYear();
  const m = String(dateValue.getMonth() + 1).padStart(2, "0");
  const d = String(dateValue.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const ReadingsQueryControls = forwardRef<
  ReadingsQueryControlsHandle,
  ReadingsQueryControlsProps
>(function ReadingsQueryControls(
  { defaultDate, defaultSensor, observerTimezone }: ReadingsQueryControlsProps,
  ref,
) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [sensor, setSensor] = useState(defaultSensor);
  /** Empty on first paint so SSR and hydration match; cache/API fill in useEffect. */
  const [sensors, setSensors] = useState<string[]>([]);
  const [sensorLoadError, setSensorLoadError] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarValue = useMemo(() => toDateValue(date), [date]);

  useImperativeHandle(
    ref,
    () => ({
      openDatePicker: () => {
        setIsCalendarOpen(true);
      },
    }),
    [],
  );

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
      setIsCalendarOpen(false);
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
    <div className="relative flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
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
          <span className="text-xs font-normal text-red-600 dark:text-red-400">
            {sensorLoadError}
          </span>
        ) : null}
      </label>
      {isCalendarOpen ? (
        <div
          className="lux-date-picker absolute bottom-full right-0 z-40 mb-2 w-auto p-0"
          style={{
            background: "transparent",
          }}
          aria-label={`Date picker ${observerTimezone ? `(${observerTimezone})` : "(UTC)"}`}
        >
          <Calendar
            value={calendarValue}
            inline
            showWeek
            onChange={(e) => {
              if (!e.value) return;
              const picked = Array.isArray(e.value) ? e.value[0] : e.value;
              if (!(picked instanceof Date)) return;
              onDateChange(toDateParam(picked));
            }}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsCalendarOpen(false)}
              className="border px-2 py-1 text-xs"
              style={{
                borderColor: "var(--app-card-border)",
                color: "var(--app-text-muted)",
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
