"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type AppTheme,
  isAppTheme,
  THEME_STORAGE_KEY,
} from "@/app/lib/theme/appTheme";

function readThemeFromDom(): AppTheme {
  if (typeof document === "undefined") return "light";
  const raw = document.documentElement.getAttribute("data-theme");
  return isAppTheme(raw) ? raw : "light";
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(() => onChange());
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    readThemeFromDom,
    () => "light",
  );

  const setMode = useCallback((next: AppTheme) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className="flex shrink-0 rounded-lg border p-0.5"
      style={{
        borderColor: "var(--app-card-border)",
        background: "var(--app-field-surface)",
      }}
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        onClick={() => setMode("light")}
        className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: theme === "light" ? "var(--app-page-bg-accent)" : "transparent",
          color: "var(--app-text)",
        }}
        aria-pressed={theme === "light"}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setMode("dark")}
        className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: theme === "dark" ? "var(--app-page-bg-accent)" : "transparent",
          color: "var(--app-text)",
        }}
        aria-pressed={theme === "dark"}
      >
        Dark
      </button>
    </div>
  );
}
