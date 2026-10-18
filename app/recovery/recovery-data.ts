import { dateKey, dateOffset, OverviewStore, parseDate } from "../overview/overview-data";

export type Metric = "sleep" | "screen" | "nutrition";
export type Period = 7 | 14 | 30;
export type Source = "phone" | "manual" | "photo";
export interface SleepRecord { date: string; bedTime: string | null; wakeTime: string | null; minutes: number; source: "phone" | "manual"; note: string }
export interface ScreenRecord { date: string; minutes: number; source: "phone" | "manual"; note: string }
export interface Meal { id: string; date: string; time: string; name: string; calories: number; source: "photo" | "manual"; note: string }
export interface Targets { sleep: number; screen: number; nutrition: number }
export interface RecoveryStore { version: 1; sleep: SleepRecord[]; screen: ScreenRecord[]; meals: Meal[]; period: Period; metric: Metric; targets: Targets; syncedAt: string }
export const RECOVERY_STORAGE_KEY = "performance-recovery:v1";
export const metricLabels: Record<Metric, string> = { sleep: "Сон", screen: "Экранное время", nutrition: "Питание" };
export const sourceLabels: Record<Source, string> = { phone: "Телефон", manual: "Внесено вручную", photo: "Фото еды" };
export const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDate(value)) === value;
export const validTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function sleepMinutes(bed: string, wake: string) {
  if (!validTime(bed) || !validTime(wake)) return 0;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return (minutes(wake) - minutes(bed) + 1440) % 1440;
}
export function duration(minutes: number) { return `${Math.floor(Math.round(minutes) / 60)} ч ${String(Math.round(minutes) % 60).padStart(2, "0")} мин`; }
export const calories = (value: number) => new Intl.NumberFormat("ru-RU").format(Math.round(value));
export function periodDates(today: Date, period: Period) { return Array.from({ length: period }, (_, index) => dateKey(dateOffset(today, index - period + 1))); }

export function createRecoveryStore(today = new Date()): RecoveryStore {
  const sleep: SleepRecord[] = [], screen: ScreenRecord[] = [], meals: Meal[] = [];
  const times = [["22:20", "06:15"], ["23:43", "06:07"], ["23:58", "08:19"], ["23:01", "05:19"], ["22:30", "06:40"], ["22:41", "06:02"], ["22:52", "06:40"], ["23:06", "05:35"], ["22:43", "06:28"], ["23:17", "06:26"], ["22:23", "07:02"], ["23:58", "06:11"], ["23:02", "06:59"], ["22:38", "06:10"]];
  for (let index = 0; index < 30; index++) {
    const date = dateKey(dateOffset(today, -index));
    const [bedTime, wakeTime] = times[index % times.length];
    if (index !== 4 && index !== 22) sleep.push({ date, bedTime, wakeTime, minutes: sleepMinutes(bedTime, wakeTime), source: "phone", note: "" });
    if (index !== 9) screen.push({ date, minutes: [368, 324, 356, 310, 344, 387, 320, 362, 345, 350, 301, 286, 300, 297][index % 14], source: "phone", note: "" });
    if (index !== 6) {
      const totals = index === 0 ? [350, 520, 260] : [530 + index % 4 * 40, 750 + index % 3 * 60, 620 + index % 5 * 35];
      ["Завтрак", "Обед", "Ужин"].forEach((name, mealIndex) => meals.push({ id: `demo-meal-${date}-${mealIndex}`, date, time: ["09:00", "14:00", "19:00"][mealIndex], name, calories: totals[mealIndex], source: "photo", note: "" }));
    }
  }
  return { version: 1, sleep, screen, meals, period: 14, metric: "sleep", targets: { sleep: 480, screen: 300, nutrition: 2500 }, syncedAt: `${dateKey(today)}T19:55:00` };
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const noteValid = (value: unknown): value is string => typeof value === "string" && value.length <= 1000;
export function readRecoveryStore(today = new Date()): RecoveryStore {
  try {
    const item: unknown = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY) || "null");
    if (!record(item) || item.version !== 1 || !Array.isArray(item.sleep) || !Array.isArray(item.screen) || !Array.isArray(item.meals) || !record(item.targets)) return createRecoveryStore(today);
    if (!item.sleep.every(day => record(day) && validDate(day.date) && (day.bedTime === null || validTime(day.bedTime)) && (day.wakeTime === null || validTime(day.wakeTime)) && number(day.minutes, 1, 1439) && ["phone", "manual"].includes(String(day.source)) && noteValid(day.note))) return createRecoveryStore(today);
    if (!item.screen.every(day => record(day) && validDate(day.date) && number(day.minutes, 0, 1440) && ["phone", "manual"].includes(String(day.source)) && noteValid(day.note))) return createRecoveryStore(today);
    if (!item.meals.every(meal => record(meal) && typeof meal.id === "string" && validDate(meal.date) && validTime(meal.time) && typeof meal.name === "string" && meal.name.trim().length > 0 && meal.name.length <= 80 && number(meal.calories, 1, 20000) && ["photo", "manual"].includes(String(meal.source)) && noteValid(meal.note))) return createRecoveryStore(today);
    if (!number(item.targets.sleep, 60, 960) || !number(item.targets.screen, 30, 1440) || !number(item.targets.nutrition, 500, 10000)) return createRecoveryStore(today);
    if (typeof item.syncedAt !== "string" || !Number.isFinite(Date.parse(item.syncedAt))) return createRecoveryStore(today);
    const uniqueDays = <T extends { date: string }>(items: T[]) => Array.from(new Map(items.map(day => [day.date, day])).values());
    return { ...(item as unknown as RecoveryStore), sleep: uniqueDays(item.sleep as SleepRecord[]), screen: uniqueDays(item.screen as ScreenRecord[]), meals: Array.from(new Map((item.meals as Meal[]).map(meal => [meal.id, meal])).values()), period: [7, 14, 30].includes(Number(item.period)) ? item.period as Period : 14, metric: ["sleep", "screen", "nutrition"].includes(String(item.metric)) ? item.metric as Metric : "sleep" };
  } catch { return createRecoveryStore(today); }
}

export interface DayValue { date: string; value: number | null; source: Source | null; count: number }
export function metricDays(store: RecoveryStore, metric: Metric, dates: string[]): DayValue[] {
  return dates.map(date => {
    if (metric === "nutrition") {
      const meals = store.meals.filter(meal => meal.date === date);
      return { date, value: meals.length ? meals.reduce((sum, meal) => sum + meal.calories, 0) : null, source: meals.length ? meals.some(meal => meal.source === "manual") ? "manual" : "photo" : null, count: meals.length };
    }
    const entry = store[metric].find(day => day.date === date);
    return { date, value: entry?.minutes ?? null, source: entry?.source ?? null, count: entry ? 1 : 0 };
  });
}
export function withSleep(store: RecoveryStore, entry: SleepRecord): RecoveryStore { return { ...store, sleep: [...store.sleep.filter(day => day.date !== entry.date), entry] }; }
export function withScreen(store: RecoveryStore, entry: ScreenRecord): RecoveryStore { return { ...store, screen: [...store.screen.filter(day => day.date !== entry.date), entry] }; }
export function withMeal(store: RecoveryStore, entry: Meal): RecoveryStore { return { ...store, meals: [...store.meals.filter(meal => meal.id !== entry.id), entry] }; }

export function overviewWithSleep(store: OverviewStore, entry: SleepRecord): OverviewStore {
  const existing = store.sleep.find(day => day.date === entry.date);
  return { ...store, sleep: [...store.sleep.filter(day => day.date !== entry.date), { ...existing, date: entry.date, hours: entry.minutes / 60, energy: existing?.energy ?? 0, note: entry.note, sleepLogged: true }] };
}
// Overview's manually entered nights have a note field; its generated examples do not.
// Preserve unknown bed/wake times rather than inventing times for a duration-only edit.
export function mergeOverviewSleep(store: RecoveryStore, overview: OverviewStore): RecoveryStore {
  let next = store;
  for (const day of overview.sleep) {
    if (typeof day.note !== "string" || day.sleepLogged === false || day.hours <= 0 || day.hours >= 24) continue;
    const minutes = Math.round(day.hours * 60), existing = next.sleep.find(item => item.date === day.date);
    if (existing?.minutes === minutes && existing.note === day.note) continue;
    next = withSleep(next, { date: day.date, minutes, bedTime: existing?.minutes === minutes ? existing.bedTime : null, wakeTime: existing?.minutes === minutes ? existing.wakeTime : null, source: "manual", note: day.note });
  }
  return next;
}
