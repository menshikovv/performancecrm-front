import { dateKey, dateOffset, mean, OverviewStore, parseDate } from "../overview/overview-data";
import { RecoveryStore } from "../recovery/recovery-data";
import { Attempt, balanceLabels, TestKey, TestsStore } from "../tests/tests-data";
import { dailyGameMetrics, GameStore } from "../game/game-data";

export type Preset = 7 | 30 | 90 | 365 | "custom";
export type RecoveryMetric = "sleep" | "screen" | "nutrition";
export type Condition = "mood" | "energy" | "sleep" | "screen" | "nutrition" | "cognitive";
export type GameMetric = "kd" | "rating" | "winrate";
export interface Range { start: string; end: string }
export interface StatsPreferences { version: 1; preset: Preset; custom: Range; mode: "overview" | "correlation"; recovery: RecoveryMetric; moodVisible: boolean; energyVisible: boolean; includeDemo: boolean; condition: Condition; gameMetric: GameMetric }
export interface DayStats { date: string; mood: number | null; energy: number | null; sleep: number | null; screen: number | null; nutrition: number | null; cognitive: number | null; kd: number | null; rating: number | null; winrate: number | null }
export interface StatsHistory { days: DayStats[]; attempts: Attempt[]; tests?: TestsStore; includeDemo: boolean }
export interface Inputs { overview?: OverviewStore; recovery?: RecoveryStore; tests?: TestsStore; games?: GameStore }
export const STATS_STORAGE_KEY = "performance-stats:v1";
export const conditionLabels: Record<Condition, string> = { mood: "Настроение", energy: "Энергия", sleep: "Сон", screen: "Экранное время", nutrition: "Питание", cognitive: "Когнитивная форма" };
export const gameLabels: Record<GameMetric, string> = { kd: "K/D", rating: "Рейтинг матча", winrate: "Победы, %" };
export const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDate(value)) === value;
const dayNumber = (date: string) => { const parsed = parseDate(date); return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) / 86400000; };
export function rangeDays(range: Range) { return Math.round(dayNumber(range.end) - dayNumber(range.start)) + 1; }
export function validRange(range: Range, today: string) { return validDate(range.start) && validDate(range.end) && range.start <= range.end && range.end <= today && rangeDays(range) <= 366; }
export function datesInRange(range: Range): string[] { const count = rangeDays(range); return Number.isFinite(count) && count > 0 && count <= 366 ? Array.from({ length: count }, (_, index) => dateKey(dateOffset(parseDate(range.start), index))) : []; }
export function currentRange(preferences: StatsPreferences, today: Date): Range { return preferences.preset === "custom" ? preferences.custom : { start: dateKey(dateOffset(today, 1 - preferences.preset)), end: dateKey(today) }; }
export function previousRange(range: Range): Range { return { start: dateKey(dateOffset(parseDate(range.start), -rangeDays(range))), end: dateKey(dateOffset(parseDate(range.start), -1)) }; }
export function defaultPreferences(today = new Date()): StatsPreferences { return { version: 1, preset: 30, custom: { start: dateKey(dateOffset(today, -29)), end: dateKey(today) }, mode: "overview", recovery: "sleep", moodVisible: true, energyVisible: true, includeDemo: true, condition: "sleep", gameMetric: "kd" }; }
export function readPreferences(today = new Date()): StatsPreferences {
  const fallback = defaultPreferences(today);
  try {
    const item = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) || "null");
    if (!item || item.version !== 1) return fallback;
    return { ...fallback, preset: [7, 30, 90, 365, "custom"].includes(item.preset) ? item.preset : 30, custom: item.custom && validRange(item.custom, dateKey(today)) ? item.custom : fallback.custom, mode: item.mode === "correlation" ? "correlation" : "overview", recovery: ["sleep", "screen", "nutrition"].includes(item.recovery) ? item.recovery : "sleep", moodVisible: item.moodVisible !== false, energyVisible: item.energyVisible !== false, includeDemo: item.includeDemo !== false, condition: Object.hasOwn(conditionLabels, item.condition) ? item.condition : "sleep", gameMetric: Object.hasOwn(gameLabels, item.gameMetric) ? item.gameMetric : "kd" };
  } catch { return fallback; }
}

const emptyDay = (date: string): DayStats => ({ date, mood: null, energy: null, sleep: null, screen: null, nutrition: null, cognitive: null, kd: null, rating: null, winrate: null });
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
export function buildHistory(today: Date, inputs: Inputs, includeDemo: boolean): StatsHistory {
  const map = new Map<string, DayStats>();
  const attempts: Attempt[] = [];
  const keys: TestKey[] = ["visual", "go", "back", "stroop", "span"];
  if (includeDemo) for (let offset = 731; offset >= 0; offset--) {
    const date = dateKey(dateOffset(today, -offset)), t = 29 - offset;
    const day = emptyDay(date);
    if (offset % 14 !== 13) {
      day.mood = round(Math.max(1, Math.min(10, 6 + 1.1 * Math.sin(t * .48) + .55 * Math.cos(t * 1.21))));
      day.energy = round(Math.max(1, Math.min(10, 5.9 + 1.0 * Math.sin(t * .48 - .4) + .45 * Math.cos(t * 1.07))));
      day.sleep = offset % 6 === 5 ? null : round(7.2 + .65 * Math.sin(t * .35) + .3 * Math.cos(t * .88), 2);
      day.screen = offset % 11 === 8 ? null : round(5.4 + .8 * Math.cos(t * .38), 2);
      day.nutrition = offset % 10 === 7 ? null : Math.round(2350 + 290 * Math.sin(t * .39));
      day.kd = round(.35 + (day.sleep ?? 7) * .11 + Math.sin(t * 1.8) * .12, 2);
      day.rating = round(.4 + day.energy * .13 + Math.cos(t * 1.4) * .16, 2);
      day.winrate = Math.round(Math.max(0, Math.min(100, 24 + day.mood * 5 + Math.sin(t * .9) * 13)));
    }
    map.set(date, day);
    if (offset % 5 === 1 || [32, 39, 46, 53, 58].includes(offset)) {
      const batch = Math.floor(offset / 5);
      const selected = offset >= 30 && offset < 60 && offset % 5 !== 1 ? keys.slice(0, 1) : [keys[batch % 5], keys[(batch + 1) % 5], keys[(batch + 2) % 5]];
      selected.forEach((test, index) => attempts.push({ id: `stats-demo-${date}-${test}`, date, test, createdAt: `${date}T12:${String(index).padStart(2, "0")}:00.000Z`, correct: 8, total: 10, reactionMs: 500, score: round([73.6, 78.2, 61.5, 54.7, 64.8][keys.indexOf(test)] + Math.sin(offset * .6 + index) * 7), status: "counted" }));
    }
  }
  const get = (date: string) => { if (!map.has(date)) map.set(date, emptyDay(date)); return map.get(date)!; };
  if (inputs.overview) {
    const dashboard = inputs.overview;
    const groups = new Map<string, typeof dashboard.mood>();
    dashboard.mood.forEach(sample => groups.set(sample.date, [...(groups.get(sample.date) ?? []), sample]));
    groups.forEach((samples, date) => { const entered = samples.filter(item => !item.id.startsWith("demo-")); get(date).mood = mean((entered.length ? entered : samples).map(item => item.value)); });
    dashboard.sleep.forEach(day => { get(day.date).energy = day.energy; if (day.sleepLogged !== false) get(day.date).sleep = day.hours; });
    Object.entries(dashboard.daily).forEach(([date, values]) => { const day = get(date); if (day.mood === null && values.mood) day.mood = values.mood * 2; if (day.energy === null && values.energy) day.energy = values.energy * 2; });
  }
  if (inputs.recovery) {
    const source = inputs.recovery;
    const covered = [...source.sleep, ...source.screen, ...source.meals].map(item => item.date).sort();
    if (covered.length) map.forEach(day => { if (day.date >= covered[0] && day.date <= covered.at(-1)!) { day.sleep = null; day.screen = null; day.nutrition = null; } });
    source.sleep.forEach(day => { get(day.date).sleep = day.minutes / 60; });
    source.screen.forEach(day => { get(day.date).screen = day.minutes / 60; });
    const totals = new Map<string, number>();
    source.meals.forEach(meal => totals.set(meal.date, (totals.get(meal.date) ?? 0) + meal.calories));
    totals.forEach((value, date) => { get(date).nutrition = value; });
  }
  if (inputs.tests) {
    const source = inputs.tests;
    const dates = [...new Set(source.attempts.map(item => item.date))].sort();
    if (dates.length) for (let index = attempts.length - 1; index >= 0; index--) if (attempts[index].date >= dates[0] && attempts[index].date <= dates.at(-1)!) attempts.splice(index, 1);
    attempts.push(...source.attempts);
    const grouped = new Map<string, typeof source.checkins>();
    source.checkins.forEach(item => grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]));
    grouped.forEach((entries, date) => { get(date).mood = mean(entries.map(item => item.mood)); get(date).energy = mean(entries.map(item => item.energy)); });
  }
  if (inputs.games) dailyGameMetrics(inputs.games.games).forEach(values => {
    const day = get(values.date);
    day.kd = values.kd; day.rating = values.rating; day.winrate = values.winrate;
  });
  const scores = new Map<string, Attempt[]>();
  attempts.filter(item => item.status === "counted").forEach(item => scores.set(item.date, [...(scores.get(item.date) ?? []), item]));
  scores.forEach((entries, date) => { const latest = keys.flatMap(test => [...entries].filter(item => item.test === test).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 1)); get(date).cognitive = mean(latest.map(item => item.score)); });
  return { days: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)), attempts, tests: inputs.tests, includeDemo };
}

export function rangeRows(history: StatsHistory, range: Range) { const map = new Map(history.days.map(day => [day.date, day])); return datesInRange(range).map(date => map.get(date) ?? emptyDay(date)); }
export function average(rows: DayStats[], key: keyof Omit<DayStats, "date">): number | null { const values = rows.flatMap(day => day[key] === null ? [] : [day[key]!]); return values.length ? mean(values) : null; }
export function rangeAttempts(history: StatsHistory, range: Range) { return history.attempts.filter(item => item.date >= range.start && item.date <= range.end); }
export function activeDays(rows: DayStats[], attempts: Attempt[]) { const completed = new Set(attempts.map(item => item.date)); return rows.filter(day => completed.has(day.date) || [day.mood, day.energy, day.sleep, day.screen, day.nutrition, day.kd, day.rating, day.winrate].some(value => value !== null)).length; }
export function cognitiveSummary(history: StatsHistory, range: Range, test: TestKey) { const values = rangeAttempts(history, range).filter(item => item.test === test && item.status === "counted"); return { score: values.length ? mean(values.map(item => item.score)) : null, count: values.length, points: values.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(item => item.score) }; }
export function balanceSummary(history: StatsHistory, range: Range, previous = false) {
  const weeks = history.tests?.weekly.filter(item => item.week <= range.end && dateKey(dateOffset(parseDate(item.week), 6)) >= range.start) ?? [];
  if (weeks.length) return { values: balanceLabels.map((_, index) => mean(weeks.map(item => item.balance[index]))), count: weeks.length, demo: false };
  return { values: history.includeDemo ? previous ? [4, 7.2, 7.5, 6.2, 5.7, 9.2, 4.5, 7.5] : [4.5, 7.9, 7.8, 6.2, 4.7, 8.6, 5.4, 8.1] : null, count: 0, demo: history.includeDemo };
}

export interface Pair { date: string; x: number; y: number }
export function correlationPairs(rows: DayStats[], condition: Condition, metric: GameMetric): Pair[] { return rows.flatMap(day => day[condition] === null || day[metric] === null ? [] : [{ date: day.date, x: day[condition]!, y: day[metric]! }]); }
export function pearson(pairs: Pair[]): number | null {
  if (pairs.length < 5) return null;
  const mx = mean(pairs.map(item => item.x)), my = mean(pairs.map(item => item.y));
  let xy = 0, xx = 0, yy = 0;
  pairs.forEach(item => { const x = item.x - mx, y = item.y - my; xy += x * y; xx += x * x; yy += y * y; });
  if (xx < 1e-12 || yy < 1e-12) return null;
  return Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy)));
}
export function correlationLabel(value: number | null) { return value === null ? "Недостаточно данных" : Math.abs(value) >= .7 ? "Сильная связь" : Math.abs(value) >= .4 ? "Умеренная связь" : "Слабая связь"; }
