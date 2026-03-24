"use client";

import { useEffect } from "react";

const PREFERS_DARK = "(prefers-color-scheme: dark)";

function applySystemTheme() {
  const dark = window.matchMedia(PREFERS_DARK).matches;
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

/** Keeps `data-theme` in sync with the OS color scheme (including live changes). */
export function SystemThemeSync() {
  useEffect(() => {
    applySystemTheme();
    const mq = window.matchMedia(PREFERS_DARK);
    const onChange = () => applySystemTheme();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
