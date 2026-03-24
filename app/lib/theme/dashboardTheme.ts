/**
 * Dashboard theme. Mirror brand hexes in `app/globals.css` (`--brand-*`).
 * Light/dark app chrome (`--app-*`, page bg `#ededed` / `#333833`) lives in
 * `globals.css` on `html[data-theme="light"|"dark"]`. Chart greens stay on `html`.
 */
export const brandPalette = {
  deepForest: "#094630",
  seaGreen: "#058B64",
  pineTeal: "#283F2E",
  seaweed: "#37AC83",
  turfGreen: "#2A7155",
} as const;

export type BrandPaletteKey = keyof typeof brandPalette;

export const dashboardTheme = {
  brandPalette,

  /** Axis + lux series line strokes (`--chart-axis`, `--chart-line`). */
  chartStroke: brandPalette.pineTeal,
  /** Sun-event glyph outlines on `LuxReadingsChart`. */
  chartGlyphStroke: brandPalette.turfGreen,

  hunterGreen: "#2F5D40",
  celadon: "#94C597",
  seaGreen: "#62996D",
  deepTeal: "#497359",
  evergreen: "#072414",

  /** Mirror globals.css — white surfaces, green accents */
  appPageBackground: "#FFFFFF",
  appPageBackgroundAccent: "#F4F7F4",
  cardSurface: "#FFFFFF",
  cardBorder: "rgba(47, 93, 64, 0.22)",
  brushHolderFill: "#FFFFFF",
  brushHolderBorder: "rgba(47, 93, 64, 0.28)",

  /**
   * Sun glyph fills (warm/cool accents for dawn→dusk). Not the same as `brandPalette`;
   * only outlines use `chartGlyphStroke` (Turf Green).
   */
  chartSunCivilDawn: "#8A7218",
  chartSunSunrise: "#E8B86D",
  chartSunSolarNoon: "#E6CF7A",
  chartSunSunset: "#D4A574",
  chartSunCivilDusk: "#2A4556",
} as const;

export type DashboardThemeKey = keyof typeof dashboardTheme;
