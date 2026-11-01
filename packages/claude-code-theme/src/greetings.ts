/**
 * Greeting text pool.
 *
 * Every Chinese line below comes from jyking/claude2cn, the userscript
 * localisation dictionary for claude.ai (en2cn.json, 32,760 entries). That
 * project is community-maintained rather than official, but it is a real
 * translation memory of shipped UI strings, so these lines do correspond to
 * strings the product actually renders.
 *
 * Entries whose only difference is the `{name}` placeholder are collapsed to
 * the bare form here: the name is not available in this host, and keeping one
 * variant avoids duplicate art.
 *
 * Verified absent from the dictionary and therefore excluded: "中午好", "晚安",
 * "我准备好了，你呢？". Those came from a second-hand list with zero hits in the
 * source, so they were dropped rather than filled in by guesswork.
 */

/** Kind of line, used to decide which pool applies to a moment. */
export type GreetingKind = 'time' | 'weekday' | 'return' | 'identity' | 'input';

export interface GreetingEntry {
  /** Stable id; also the art filename stem. */
  id: string;
  text: string;
  kind: GreetingKind;
  /** Inclusive lower / exclusive upper hour bound, for kind === 'time'. */
  from?: number;
  to?: number;
  /** Weekday key, for kind === 'weekday'. */
  day?: string;
}

/**
 * Time-of-day greetings.
 *
 * The source defines exactly four day parts: morning, afternoon, evening and
 * late-night. There is no midday variant, so no 11:00-13:00 slot exists and the
 * afternoon span simply starts at noon.
 */
export const TIME_GREETINGS: GreetingEntry[] = [
  { id: 'morning', text: '早上好', kind: 'time', from: 5, to: 12 },
  { id: 'afternoon', text: '下午好', kind: 'time', from: 12, to: 18 },
  { id: 'evening', text: '晚上好', kind: 'time', from: 18, to: 23 },
  // Late night wraps past midnight; 23-24 and 0-5 are one period.
  { id: 'latenight', text: '夜深了', kind: 'time', from: 23, to: 29 },
];

/** Weekday greetings, one per day. */
export const WEEKDAY_GREETINGS: GreetingEntry[] = [
  { id: 'mon', text: '周一愉快', kind: 'weekday', day: 'mon' },
  { id: 'tue', text: '周二愉快', kind: 'weekday', day: 'tue' },
  { id: 'wed', text: '周三愉快', kind: 'weekday', day: 'wed' },
  { id: 'thu', text: '周四快乐', kind: 'weekday', day: 'thu' },
  { id: 'fri', text: '周五愉快', kind: 'weekday', day: 'fri' },
  { id: 'sat', text: '周六愉快！', kind: 'weekday', day: 'sat' },
  { id: 'sun', text: '周日愉快', kind: 'weekday', day: 'sun' },
];

/** Lines shown when the user comes back after a gap. */
export const RETURN_GREETINGS: GreetingEntry[] = [
  { id: 'welcome-back', text: '欢迎回来', kind: 'return' },
  { id: 'back-at-it', text: '重返工作！', kind: 'return' },
];

/** First-run / identity lines. */
export const IDENTITY_GREETINGS: GreetingEntry[] = [
  { id: 'iam-claude', text: '你好，我是 Claude。', kind: 'identity' },
  { id: 'welcome-claude', text: '欢迎！我是 Claude。', kind: 'identity' },
];

/** Input placeholder; not an empty-state greeting, kept for completeness. */
export const INPUT_GREETINGS: GreetingEntry[] = [
  { id: 'how-can-i-help', text: '今天我能帮您什么？', kind: 'input' },
];

/** Special address used when the user is habitually active late. */
export const NIGHT_OWL_TEXT = '你好，夜猫子';

export const ALL_GREETINGS: GreetingEntry[] = [
  ...TIME_GREETINGS,
  ...WEEKDAY_GREETINGS,
  ...RETURN_GREETINGS,
  ...IDENTITY_GREETINGS,
  ...INPUT_GREETINGS,
];

/** Weekday key in the app's mon-first form. */
export function weekdayKey(date: Date): string {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[date.getDay()];
}

/**
 * Hour bucket used by the greeting grid.
 *
 * 0 = late night (23-5), 1 = morning (6-11), 2 = afternoon (12-17),
 * 3 = evening (18-22).
 *
 * Late night starts at 23, matching TIME_GREETINGS where the late-night span
 * begins at 23:00. Bucketing 23 as "evening" would split the period in two and
 * make the night-owl counter miss the most common late hour.
 */
export function hourBucketOf(hour: number): number {
  if (hour >= 23 || hour < 6) return 0;
  if (hour < 12) return 1;
  if (hour < 18) return 2;
  return 3;
}

/**
 * Locates the time greeting for an hour.
 *
 * Late night wraps past midnight, so hours 0-5 are matched against the 23-29
 * span by adding 24 rather than duplicating the entry.
 */
export function timeGreetingFor(hour: number): GreetingEntry {
  const h = hour < 5 ? hour + 24 : hour;
  for (const entry of TIME_GREETINGS) {
    const from = entry.from as number;
    const to = entry.to as number;
    if (h >= from && h < to) return entry;
  }
  return TIME_GREETINGS[TIME_GREETINGS.length - 1];
}

/** The weekday greeting for a date. */
export function weekdayGreetingFor(date: Date): GreetingEntry | undefined {
  const key = weekdayKey(date);
  return WEEKDAY_GREETINGS.find((entry) => entry.day === key);
}

/** Text for an entry id, falling back to the first time greeting. */
export function textForId(id: string): string {
  if (id === 'night-owl') return NIGHT_OWL_TEXT;
  const found = ALL_GREETINGS.find((entry) => entry.id === id);
  return found ? found.text : TIME_GREETINGS[0].text;
}