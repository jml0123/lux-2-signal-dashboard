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
  latestCalendarDateAnywhere,
  localCalendarDateFromIsoParam,
} from "@/app/lib/readings/dateUtils";
import { READINGS_DATA_EPOCH_DATE } from "@/app/lib/readings/readings.constants";
import { buildReadingsQueryPath } from "@/app/lib/readings/readingsQueryPath";

export type ReadingsQueryControlsProps = {
  defaultDate: string;
  defaultSensor: string;
  /** Shown next to the date field when set (IANA). */
  observerTimezone?: string;
};

export type ReadingsQueryControlsHandle = {
  openDatePicker: () => void;
};

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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarValue = useMemo(
    () => localCalendarDateFromIsoParam(date),
    [date],
  );
  const calendarMinDate = localCalendarDateFromIsoParam(
    READINGS_DATA_EPOCH_DATE,
  );
  const calendarMaxDate = localCalendarDateFromIsoParam(
    latestCalendarDateAnywhere(),
  );

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
  }, [defaultDate]);

  const onDateChange = useCallback(
    (nextDate: string) => {
      setDate(nextDate);
      router.replace(buildReadingsQueryPath(nextDate, defaultSensor));
      setIsCalendarOpen(false);
    },
    [router, defaultSensor],
  );

  return (
    <div className="relative min-h-px min-w-px self-end">
      {isCalendarOpen ? (
        <div
          className="lux-date-picker absolute bottom-full right-0 z-40 mb-2 w-auto rounded-md border p-3 shadow-sm"
          style={{
            background: "var(--app-card-surface)",
            borderColor: "var(--app-card-border)",
          }}
          aria-label={`Date picker ${observerTimezone ? `(${observerTimezone})` : "(UTC)"}`}
        >
          <Calendar
            value={calendarValue}
            minDate={calendarMinDate ?? undefined}
            maxDate={calendarMaxDate ?? undefined}
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
