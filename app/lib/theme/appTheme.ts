export const THEME_STORAGE_KEY = "lux-theme";

export type AppTheme = "light" | "dark";

export function isAppTheme(v: string | null): v is AppTheme {
  return v === "light" || v === "dark";
}
