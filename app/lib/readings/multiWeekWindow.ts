import {
  formatUtcDateParam,
  getUtcDayBounds,
  latestCalendarDateAnywhere,
  utcDateAddDays,
} from "@/app/lib/readings/dateUtils";

/**
 * Upper inclusive date for multi-week listing and loads. Buckets are UTC days, so we
 * must not use a "latest" that lags **UTC calendar today** (e.g. server resolves mdWin
 * while UTC is already April but Kiritimati format still March — April wk1 would vanish).
 */
export function multiWindowLatestUtcDate(now: Date = new Date()): string {
  const anywhere = latestCalendarDateAnywhere(now);
  const utcDay = formatUtcDateParam(now);
  return anywhere >= utcDay ? anywhere : utcDay;
}

/** Fixed ridgeline strip width (UTC days); not user-configurable. */
export const MULTI_STRIP_DAYS = 7;

/** Rolling multi-day window length (UTC days). */
export const MULTI_WINDOW_DAYS = 28;

const MD_WIN_RE = /^(\d{4})-(\d{2})-wk([1-4])$/;

export type ParsedMdWin = { y: number; m: number; w: number };

export function parseMdWin(raw: string): ParsedMdWin | null {
  const t = raw.trim();
  const match = t.match(MD_WIN_RE);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const w = Number(match[3]);
  if (!y || m < 1 || m > 12 || w < 1 || w > 4) return null;
  try {
    getUtcDayBounds(`${y}-${String(m).padStart(2, "0")}-01`);
  } catch {
    return null;
  }
  return { y, m, w };
}

export function formatMdWin(p: ParsedMdWin): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-wk${p.w}`;
}

/** Last UTC calendar day of month-week band (wk1 → day 7 … wk4 → day 28). */
export function lastUtcDateOfMonthWeek(y: number, m: number, week: number): string {
  const lastDay = week * 7;
  return formatUtcDateParam(new Date(Date.UTC(y, m - 1, lastDay)));
}

/** First UTC day of that same 7-day month band (wk1 → 1 … wk4 → 22). */
export function firstUtcDateOfMonthWeek(y: number, m: number, week: number): string {
  const firstDay = (week - 1) * 7 + 1;
  return formatUtcDateParam(new Date(Date.UTC(y, m - 1, firstDay)));
}

/** Last UTC day of week 3 in the calendar month after `epochIso` (stable multi-week anchor). */
function minStableMdWinBandEnd(epochIso: string): string {
  const [y, m] = epochIso.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return epochIso;
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny++;
  }
  return lastUtcDateOfMonthWeek(ny, nm, 3);
}

/**
 * Choosable if the month-week overlaps [epochIso, latestUtcDate]. Excludes the dataset's epoch
 * month week 4, weeks that end before `latestUtcDate` but before the stable anchor (e.g. March
 * wk4 when data runs into April), and — once `latest` has reached that anchor — any week ending
 * before it (so the minimum choice is April wk3 for a March epoch).
 */
export function isSelectableMdWin(
  token: string,
  epochIso: string,
  latestUtcDate: string,
): boolean {
  const p = parseMdWin(token);
  if (!p) return false;
  const bandEnd = lastUtcDateOfMonthWeek(p.y, p.m, p.w);
  const bandStart = firstUtcDateOfMonthWeek(p.y, p.m, p.w);
  if (bandEnd < epochIso) return false;
  if (bandStart > latestUtcDate) return false;

  const [ey, em] = epochIso.split("-").map(Number);
  if (ey && em && p.y === ey && p.m === em && p.w === 4) return false;

  const stableEnd = minStableMdWinBandEnd(epochIso);
  if (latestUtcDate >= stableEnd && bandEnd < stableEnd) return false;
  if (bandEnd < latestUtcDate && bandEnd < stableEnd) return false;
  return true;
}

function monthKeysFromTo(
  startY: number,
  startM: number,
  endY: number,
  endM: number,
): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  let y = startY;
  let m = startM;
  const endKey = endY * 12 + (endM - 1);
  while (y * 12 + (m - 1) <= endKey) {
    out.push({ y, m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** All `YYYY-MM-wkK` tokens allowed by `isSelectableMdWin` (oldest → newest). */
export function listEligibleMdWins(
  epochIso: string,
  latestUtcDate: string,
): string[] {
  const [ey, em] = epochIso.split("-").map(Number);
  const [ly, lm] = latestUtcDate.split("-").map(Number);
  if (!ey || !em || !ly || !lm) return [];
  const keys = monthKeysFromTo(ey, em, ly, lm);
  const out: string[] = [];
  for (const { y, m } of keys) {
    for (let w = 1; w <= 4; w++) {
      const tok = formatMdWin({ y, m, w });
      if (isSelectableMdWin(tok, epochIso, latestUtcDate)) out.push(tok);
    }
  }
  return out;
}

export function defaultMdWinToken(
  epochIso: string,
  latestUtcDate: string,
): string | null {
  const all = listEligibleMdWins(epochIso, latestUtcDate);
  return all.length ? all[all.length - 1]! : null;
}

export function resolveMdWinParam(
  raw: string | undefined,
  epochIso: string,
  latestUtcDate: string,
): string | null {
  const t = raw?.trim();
  if (t && isSelectableMdWin(t, epochIso, latestUtcDate)) {
    const p = parseMdWin(t);
    return p ? formatMdWin(p) : null;
  }
  return defaultMdWinToken(epochIso, latestUtcDate);
}

function weekInMonthFromDay(day: number): 1 | 2 | 3 | 4 {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function formatMonthYearWeekLabel(y: number, m: number, week: number): string {
  const mon = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
  return `${mon} ${y}, Week ${week}`;
}

type Ymd = { y: number; m: number; d: number };

function monthShortUtc(y: number, m: number, d: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Distinct strip label when month-week numbers would repeat (e.g. Mar 22–28 vs Mar 29–Apr 4). */
function formatUtcDaySpanLabel(a: Ymd, b: Ymd): string {
  const ma = monthShortUtc(a.y, a.m, a.d);
  const mb = monthShortUtc(b.y, b.m, b.d);
  if (a.y === b.y && a.m === b.m) {
    return `${ma} ${a.d}–${b.d}, ${a.y}`;
  }
  if (a.y === b.y) {
    return `${ma} ${a.d} – ${mb} ${b.d}, ${a.y}`;
  }
  return `${ma} ${a.d}, ${a.y} – ${mb} ${b.d}, ${b.y}`;
}

/** Dropdown / URL token → same visual as strip labels. */
export function mdWinDisplayLabel(token: string): string {
  const p = parseMdWin(token);
  if (!p) return token;
  return formatMonthYearWeekLabel(p.y, p.m, p.w);
}

export type MdWinDisplayParts = { monthYear: string; weekPart: string };

/** Month + year and week phrase for masthead-style two-tone labels (closed trigger only). */
export function mdWinDisplayParts(token: string): MdWinDisplayParts | null {
  const p = parseMdWin(token);
  if (!p) return null;
  const mon = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(p.y, p.m - 1, 1)));
  return {
    monthYear: `${mon} ${p.y}`,
    weekPart: `Week ${p.w}`,
  };
}

function parseYmd(iso: string): Ymd | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

type RidgelineStripDraft =
  | { mode: "week"; y: number; m: number; w: 1 | 2 | 3 | 4 }
  | { mode: "span"; p0: Ymd; p1: Ymd };

/**
 * Straddles use the **later** month and the week of that month’s first day in the strip (e.g.
 * Mar 29–Apr 4 → Apr, week 1). Same-month chunks with any day 29+ use a span draft (no week key).
 */
function ridgelineStripDraftForChunk(datesIso: string[]): RidgelineStripDraft | null {
  if (datesIso.length === 0) return null;
  const parts: Ymd[] = [];
  for (const iso of datesIso) {
    const p = parseYmd(iso);
    if (p) parts.push(p);
  }
  if (parts.length === 0) return null;

  const p0 = parts[0]!;
  const p1 = parts[parts.length - 1]!;
  const ymKey = (p: Ymd) => p.y * 100 + p.m;
  const straddles = ymKey(p0) !== ymKey(p1);
  const hasMonthTailDay = parts.some((p) => p.d > 28);

  if (straddles) {
    const lateYm = ymKey(p1);
    const firstInLateMonth = parts.find((p) => ymKey(p) === lateYm)!;
    return {
      mode: "week",
      y: firstInLateMonth.y,
      m: firstInLateMonth.m,
      w: weekInMonthFromDay(firstInLateMonth.d),
    };
  }

  if (hasMonthTailDay) {
    return { mode: "span", p0, p1 };
  }

  return {
    mode: "week",
    y: p0.y,
    m: p0.m,
    w: weekInMonthFromDay(p0.d),
  };
}

/** Next week within 1–4 / month; week 4 → following month week 1 (year rolls Dec → Jan). */
function bumpMonthWeek(
  y: number,
  m: number,
  w: 1 | 2 | 3 | 4,
): { y: number; m: number; w: 1 | 2 | 3 | 4 } {
  if (w < 4) return { y, m, w: (w + 1) as 1 | 2 | 3 | 4 };
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny++;
  }
  return { y: ny, m: nm, w: 1 };
}

function sameMonthWeek(
  a: { y: number; m: number; w: number },
  b: { y: number; m: number; w: number },
): boolean {
  return a.y === b.y && a.m === b.m && a.w === b.w;
}

/**
 * Labels for ridgeline strips (oldest chunk first). Week labels match per-strip rules, then a pass
 * ensures no two **consecutive** strips share the same month/week (bump week, rolling w4 → next
 * month w1).
 */
export function ridgelineStripLabelsForChunks(chunks: string[][]): string[] {
  const drafts = chunks.map((c) => ridgelineStripDraftForChunk(c));
  const out: string[] = [];
  let prevWeek: { y: number; m: number; w: number } | null = null;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    if (!draft) {
      out.push("");
      prevWeek = null;
      continue;
    }

    if (draft.mode === "span") {
      out.push(formatUtcDaySpanLabel(draft.p0, draft.p1));
      prevWeek = null;
      continue;
    }

    let { y, m, w } = draft;
    while (prevWeek !== null && sameMonthWeek(prevWeek, { y, m, w })) {
      ({ y, m, w } = bumpMonthWeek(y, m, w));
    }
    out.push(formatMonthYearWeekLabel(y, m, w));
    prevWeek = { y, m, w };
  }

  return out;
}

/** Single-strip helper; for collision-aware labels use `ridgelineStripLabelsForChunks`. */
export function ridgelineStripLabelForChunk(datesIso: string[]): string {
  return ridgelineStripLabelsForChunks([datesIso])[0] ?? "";
}

/**
 * Up to 28 UTC days of lookback from the chosen month-week, drawn through `latestUtcDate`
 * (so short histories show all days from epoch to latest, not only through the week band end).
 */
export function multiWindowDatesForMdWinClamped(
  token: string,
  epochIso: string,
  latestUtcDate: string,
): string[] | null {
  const p = parseMdWin(token);
  if (!p) return null;
  const nominalEnd = lastUtcDateOfMonthWeek(p.y, p.m, p.w);
  const chartEnd = latestUtcDate;
  if (chartEnd < epochIso) return null;

  const idealStart = utcDateAddDays(nominalEnd, -(MULTI_WINDOW_DAYS - 1));
  const start = idealStart > epochIso ? idealStart : epochIso;
  if (start > chartEnd) return null;
  const out: string[] = [];
  let d = start;
  while (true) {
    out.push(d);
    if (d >= chartEnd) break;
    d = utcDateAddDays(d, 1);
  }
  return out;
}
