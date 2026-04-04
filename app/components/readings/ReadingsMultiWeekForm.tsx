"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ReadingsControlChevronIcon } from "@/app/components/readings/ReadingsControlChevronIcon";
import {
  listEligibleMdWins,
  mdWinDisplayLabel,
  multiWindowLatestUtcDate,
} from "@/app/lib/readings/multiWeekWindow";
import { READINGS_DATA_EPOCH_DATE } from "@/app/lib/readings/readings.constants";
import { buildMultidayQueryPath } from "@/app/lib/readings/readingsQueryPath";

export type ReadingsMultiWeekFormProps = {
  currentEndWeek: string | null;
  sensor: string;
};

export function ReadingsMultiWeekForm({
  currentEndWeek,
  sensor,
}: ReadingsMultiWeekFormProps) {
  const router = useRouter();
  const latest = multiWindowLatestUtcDate();
  const options = useMemo(
    () => listEligibleMdWins(READINGS_DATA_EPOCH_DATE, latest),
    [latest],
  );

  const effectiveEndWeek =
    currentEndWeek && options.includes(currentEndWeek)
      ? currentEndWeek
      : (options[0] ?? null);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerId = useId();
  const menuId = useId();

  const pick = useCallback(
    (tok: string) => {
      if (!options.includes(tok)) return;
      router.replace(buildMultidayQueryPath(sensor, tok));
      setOpen(false);
      queueMicrotask(() => triggerRef.current?.focus());
    },
    [options, router, sensor],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || options.length === 0) return;
    const idx = Math.max(0, options.indexOf(effectiveEndWeek ?? ""));
    queueMicrotask(() => itemRefs.current[idx]?.focus());
  }, [open, options, effectiveEndWeek]);

  const onMenuItemKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(index + 1, options.length - 1);
        itemRefs.current[next]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(index - 1, 0);
        itemRefs.current[prev]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        itemRefs.current[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        itemRefs.current[options.length - 1]?.focus();
      }
    },
    [options.length],
  );

  if (options.length === 0) {
    return (
      <p
        className="max-w-xs text-center text-xs"
        style={{ color: "var(--app-text-subtle)" }}
      >
        No month-week choices in this date range yet.
      </p>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex flex-col items-center">
      <h2 className="lux-masthead-datetime m-0 text-sm leading-tight">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label="Select week window"
          onClick={() => setOpen((v) => !v)}
          className="group flex cursor-pointer flex-wrap items-center justify-center gap-x-2 border-0 bg-transparent p-0 font-[inherit]"
        >
          <span
            id={`${triggerId}-label`}
            className="inline-flex items-center gap-0.5 font-semibold tracking-tight underline decoration-transparent underline-offset-2 transition-colors group-hover:decoration-current"
            style={{ color: "var(--chart-title-date)" }}
          >
            {effectiveEndWeek ? mdWinDisplayLabel(effectiveEndWeek) : "Week window"}
            <ReadingsControlChevronIcon className="shrink-0 opacity-45 transition-opacity group-hover:opacity-70" />
          </span>
        </button>
      </h2>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={`${triggerId}-label`}
          className="absolute bottom-full left-1/2 z-40 mb-2 min-w-[min(100vw-2rem,16rem)] max-h-[min(70vh,20rem)] -translate-x-1/2 overflow-y-auto rounded-md py-1 shadow-md"
          style={{
            background: "var(--app-card-surface)",
            boxShadow:
              "0 8px 28px color-mix(in srgb, var(--app-text) 12%, transparent)",
          }}
        >
          {options.map((tok, index) => {
            const selected = tok === effectiveEndWeek;
            return (
              <button
                key={tok}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`block w-full px-3 py-2 text-left text-sm font-normal transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08] ${
                  selected
                    ? "bg-[color-mix(in_srgb,var(--app-page-bg-accent)_50%,transparent)]"
                    : ""
                }`}
                style={{ color: "var(--app-text)" }}
                onClick={() => pick(tok)}
                onKeyDown={(e) => onMenuItemKeyDown(e, index)}
              >
                {mdWinDisplayLabel(tok)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
