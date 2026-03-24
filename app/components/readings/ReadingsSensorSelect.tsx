"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

const chevronDown = (
  <svg
    className="shrink-0 opacity-45 transition-opacity group-hover:opacity-70"
    width="11"
    height="11"
    viewBox="0 0 12 12"
    aria-hidden
  >
    <path
      d="M2.5 4.25L6 7.75L9.5 4.25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function ReadingsSensorSelect({
  defaultDate,
  defaultSensor,
  className,
}: ReadingsSensorSelectProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [sensor, setSensor] = useState(defaultSensor);
  const [sensors, setSensors] = useState<string[]>([]);
  const [sensorLoadError, setSensorLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onPick = useCallback(
    (nextSensor: string) => {
      setSensor(nextSensor);
      router.replace(buildReadingsQueryPath(defaultDate, nextSensor));
      setOpen(false);
    },
    [router, defaultDate],
  );

  const label = sensor.trim() ? sensor.trim() : "All sensors";

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <div className="font-display text-sm leading-tight">
        <span className="sr-only">Sensor filter</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="group inline-flex cursor-pointer items-center gap-0.5 font-semibold underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
          style={{ color: "var(--chart-title-date)" }}
        >
          {label}
          {chevronDown}
        </button>
      </div>

      {sensorLoadError ? (
        <p
          className="mt-1 max-w-[14rem] text-xs font-normal text-red-600 dark:text-red-400"
          role="alert"
        >
          {sensorLoadError}
        </p>
      ) : null}

      {open ? (
        <div
          className="absolute top-full left-0 z-40 mt-2 min-w-[11rem] rounded-md border p-1 shadow-sm"
          style={{
            background: "var(--app-card-surface)",
            borderColor: "var(--app-card-border)",
          }}
          role="listbox"
          aria-label="Choose sensor"
        >
          <ul className="flex flex-col gap-px">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!sensor.trim()}
                onClick={() => onPick("")}
                className="w-full rounded-sm px-2 py-1.5 text-left text-xs transition-colors"
                style={{
                  background: !sensor.trim()
                    ? "var(--app-page-bg-accent)"
                    : "transparent",
                  color: "var(--app-text)",
                }}
              >
                All sensors
              </button>
            </li>
            {sensors.map((s) => {
              const active = sensor.trim() === s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onPick(s)}
                    className="w-full rounded-sm px-2 py-1.5 text-left text-xs transition-colors"
                    style={{
                      background: active
                        ? "var(--app-page-bg-accent)"
                        : "transparent",
                      color: "var(--app-text)",
                    }}
                  >
                    {s}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex justify-end border-t pt-1" style={{ borderColor: "var(--app-card-border)" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2 py-1 text-xs"
              style={{
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
}
