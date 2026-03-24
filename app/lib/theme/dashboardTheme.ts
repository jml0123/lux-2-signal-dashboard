/**
 * All dashboard color constants (TS / charts / ambient scrub / sun glyphs).
 * CSS custom properties in `app/globals.css` should stay in sync with these hexes.
 */

/**
 * Earthy greens — mirrors `--brand-*` and `--palette-*` in `globals.css`.
 * `vividSeaGreen` ↔ `--brand-sea-green`; `softSeaGreen` ↔ `--palette-sea-green`.
 */
export const earthyGreensPalette = {
  deepForest: "#094630",
  vividSeaGreen: "#058b64",
  pineTeal: "#283f2e",
  seaweed: "#37ac83",
  turfGreen: "#2a7155",
  hunterGreen: "#2f5d40",
  celadon: "#94c597",
  softSeaGreen: "#62996d",
  deepTeal: "#497359",
  evergreen: "#072414",
} as const;

export type EarthyGreensPaletteKey = keyof typeof earthyGreensPalette;

/** Ethereal chart palette — mirrors `--ethereal-*` in `globals.css`. */
export const etherealPalette = {
  duskViolet: "#8b7ab8",
  dawnLavender: "#a896cc",
  pearlBlue: "#7aaab8",
  mistSage: "#8ab89e",
  goldenHaze: "#c4a862",
  roseDusk: "#c47a8a",
  skySlate: "#8aaabb",
  aurora: "#7ab8a8",
} as const;

/**
 * One civil day for ambient scrub + aligned sun glyph fills (pre-dawn → post-dusk).
 * Indices 0 and 11 match for a seamless loop. Knots map solar times onto stops 0…11.
 */
export const AMBIENT_LIGHT_COLORS: readonly string[] = [
  "#141a38", // pre-dawn
  "#242174", // civil twilight
  "#7a2f98", // sunrise
  "#d4561c", // just after sunrise
  "#f08522", // morning
  "#ffc870", // mid-morning
  "#fff2b0", // solar noon
  "#ffbe58", // early afternoon
  "#ff9a30", // late afternoon
  "#e45618", // golden hour
  "#9c2f68", // dusk
  "#141a38", // post-dusk (loop)
] as const;

/** Legacy chart / card chrome (rarely used — prefer CSS vars in components). */
export const dashboardUiSurfaces = {
  appPageBackground: "#FFFFFF",
  appPageBackgroundAccent: "#F4F7F4",
  cardSurface: "#FFFFFF",
  cardBorder: "rgba(47, 93, 64, 0.22)",
  brushHolderFill: "#FFFFFF",
  brushHolderBorder: "rgba(47, 93, 64, 0.28)",
} as const;

export const dashboardTheme = {
  earthyGreensPalette,

  hunterGreen: earthyGreensPalette.hunterGreen,
  celadon: earthyGreensPalette.celadon,
  seaGreen: earthyGreensPalette.softSeaGreen,
  deepTeal: earthyGreensPalette.deepTeal,
  evergreen: earthyGreensPalette.evergreen,

  ...dashboardUiSurfaces,

  ethereal: etherealPalette,

  chartSunCivilDawn: AMBIENT_LIGHT_COLORS[1],
  chartSunSunrise: AMBIENT_LIGHT_COLORS[3],
  chartSunSolarNoon: AMBIENT_LIGHT_COLORS[6],
  chartSunSunset: AMBIENT_LIGHT_COLORS[9],
  chartSunCivilDusk: AMBIENT_LIGHT_COLORS[10],
} as const;

export type DashboardThemeKey = keyof typeof dashboardTheme;
