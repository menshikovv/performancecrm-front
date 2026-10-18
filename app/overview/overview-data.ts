export type CheckKey = "mood" | "energy" | "sleepQuality";
export type WidgetGroup = "state" | "sleep" | "nutrition" | "game";
export type MetricKey = "mood" | "sleep" | "readiness" | "recovery" | "nutrition" | "game";
export interface Sample { id: string; date: string; value: number; note?: string }
export interface SleepDay { date: string; hours: number; energy: number; note?: string; sleepLogged?: boolean }
export interface OverviewStore {
  version: 1;
  daily: Record<string, Partial<Record<CheckKey, number>>>;
  mood: Sample[];
  sleep: SleepDay[];
  metrics: Record<Exclude<MetricKey, "mood" | "sleep">, Sample[]>;
  widgets: WidgetGroup[];
}
export const OVERVIEW_STORAGE_KEY = "performance-overview:v1";
export const checkLabels: Record<CheckKey, string> = { mood: "Настроение", energy: "Энергия", sleepQuality: "Качество сна" };
export const metricLabels: Record<MetricKey, string> = { mood: "Настроение", sleep: "Сон и энергия", readiness: "Готовность", recovery: "Восстановление", nutrition: "Питание", game: "Игровая форма" };
export const groupLabels: Record<WidgetGroup, string> = { state: "Состояние", sleep: "Сон", nutrition: "Питание", game: "Игра" };
export function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function dateOffset(base: Date, days: number) { const date = new Date(base.getFullYear(), base.getMonth(), base.getDate()); date.setDate(date.getDate() + days); return date; }
export function parseDate(value: string) { return new Date(`${value}T12:00:00`); }
export function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
export function weekDates(today: Date) { return Array.from({ length: 7 }, (_, index) => dateKey(dateOffset(today, index - 6))); }
export function createOverviewStore(today = new Date()): OverviewStore {
  const days = weekDates(today);
  const metric = (name: string, values: number[]) => values.map((value, index) => ({ id: `demo-${name}-${index}`, date: days[index], value }));
  const daily = Object.fromEntries(Array.from({ length: 23 }, (_, index) => [dateKey(dateOffset(today, -index - 1)), { mood: 3 + index % 3, energy: 3 + index % 2, sleepQuality: 4 }]));
  return {
    version: 1, daily,
    mood: [1, 2, 3, 6, 6, 4, 8, 8, 8].map((value, index) => ({ id: `demo-mood-${index}`, date: dateKey(dateOffset(today, -6 + Math.floor(index * 6 / 9))), value })),
    sleep: [6.5, 7.5, 8.4, 7.1, 6.3, 8.7, 6.4].map((hours, index) => ({ date: days[index], hours, energy: [5.6, 7.0, 9.1, 7.5, 6.0, 4.9, 6.3][index] })),
    metrics: {
      readiness: metric("readiness", [4.6, 5.1, 4.9, 5.8, 6.2, 6.7, 7.4]),
      recovery: metric("recovery", [6.8, 6.0, 6.4, 5.1, 5.5, 4.0, 3.2]),
      nutrition: metric("nutrition", [6.2, 6.8, 7.1, 6.6, 8.1, 7.8, 8.3]),
      game: metric("game", [5.3, 5.8, 5.6, 6.5, 6.8, 7.1, 7.6]),
    },
    widgets: ["state", "sleep"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function validDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDate(value)) === value; }
function score(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10; }
function validSamples(value: unknown): value is Sample[] { return Array.isArray(value) && value.every(item => isRecord(item) && typeof item.id === "string" && validDate(item.date) && score(item.value) && (item.note === undefined || typeof item.note === "string")); }
export function readOverviewStore(today = new Date()): OverviewStore {
  const fallback = createOverviewStore(today);
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OVERVIEW_STORAGE_KEY) || "null");
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.daily) || !validSamples(parsed.mood) || !Array.isArray(parsed.sleep) || !isRecord(parsed.metrics) || !Array.isArray(parsed.widgets)) return fallback;
    if (!parsed.sleep.every(item => isRecord(item) && validDate(item.date) && typeof item.hours === "number" && Number.isFinite(item.hours) && item.hours >= 0 && item.hours <= 24 && score(item.energy) && (item.note === undefined || typeof item.note === "string") && (item.sleepLogged === undefined || typeof item.sleepLogged === "boolean"))) return fallback;
    const metrics = parsed.metrics;
    if (!["readiness", "recovery", "nutrition", "game"].every(key => validSamples(metrics[key]))) return fallback;
    if (!Object.entries(parsed.daily).every(([date, ratings]) => validDate(date) && isRecord(ratings) && Object.entries(ratings).every(([key, value]) => Object.hasOwn(checkLabels, key) && Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 5))) return fallback;
    return { ...(parsed as unknown as OverviewStore), widgets: [...new Set(parsed.widgets.filter((key): key is WidgetGroup => typeof key === "string" && Object.hasOwn(groupLabels, key)))] };
  } catch { return fallback; }
}
export function saveCheck(store: OverviewStore, key: CheckKey, value: number, today: string): OverviewStore {
  const daily = { ...store.daily, [today]: { ...store.daily[today], [key]: value } };
  const mood = key === "mood" ? [...store.mood.filter(item => item.id !== `daily-mood-${today}`), { id: `daily-mood-${today}`, date: today, value: value * 2 }] : store.mood;
  const currentSleep = store.sleep.find(item => item.date === today);
  const sleep = key === "energy" ? [...store.sleep.filter(item => item.date !== today), { date: today, hours: currentSleep?.hours ?? 0, energy: value * 2, note: currentSleep?.note, sleepLogged: currentSleep ? currentSleep.sleepLogged !== false : false }] : store.sleep;
  const readiness = [...store.metrics.readiness.filter(item => item.date !== today), { id: `daily-readiness-${today}`, date: today, value: mean(Object.values(daily[today]).map(score => score * 2)) }];
  const recovery = key === "sleepQuality" ? [...store.metrics.recovery.filter(item => item.date !== today), { id: `daily-recovery-${today}`, date: today, value: value * 2 }] : store.metrics.recovery;
  return { ...store, daily, mood, sleep, metrics: { ...store.metrics, readiness, recovery } };
}
export function streakDays(store: OverviewStore, today: Date) {
  const complete = (day: string) => Object.keys(store.daily[day] ?? {}).length === 3;
  let cursor = complete(dateKey(today)) ? today : dateOffset(today, -1);
  let count = 0;
  while (complete(dateKey(cursor)) && count < 3650) { count++; cursor = dateOffset(cursor, -1); }
  return count;
}
export function visibleSamples(samples: Sample[], dates: string[]) { const range = new Set(dates); return samples.filter(sample => range.has(sample.date)).sort((a, b) => a.date.localeCompare(b.date)); }
export function metricSamples(store: OverviewStore, key: MetricKey) { return key === "mood" ? store.mood : key === "sleep" ? store.sleep.filter(day => day.sleepLogged !== false).map(day => ({ id: day.date, date: day.date, value: day.hours, note: day.note })) : store.metrics[key]; }
export function formatHours(hours: number) { const minutes = Math.round(hours * 60); return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`; }
export function scoreStatus(value: number) { return value >= 7 ? { label: "Отлично", tone: "good" } : value >= 4 ? { label: "Средне", tone: "medium" } : { label: "Плохо", tone: "poor" }; }
