import { dateKey, dateOffset, parseDate } from "../overview/overview-data";
import { PlayerId, staffPlayers } from "../overview/staff-data";

export const NUTRITION_STORAGE_KEY = "performance-staff-nutrition:v1";
export type Meal = { id: string; player: PlayerId; date: string; time: string; title: string; calories: number; protein: number; fat: number; carbs: number; photo: boolean };
export type NutritionTarget = { calories: number; water: number };
export type NutritionPreferences = { version: 1; player: PlayerId | "all"; period: 1 | 3 | 7; photosOnly: boolean; day: string; targets: Record<PlayerId, NutritionTarget> };
type Seed = [PlayerId, string, string, number, boolean, number?, number?, number?];
const recentMeals: Seed[][] = [
  [
    ["kairo", "14:24", "Салат Цезарь", 406, true, 24, 22, 28],
    ["vexa", "13:45", "Курица с рисом", 515, true, 42, 11, 64],
    ["frost", "13:40", "Курица с рисом", 552, true, 42, 11, 64],
    ["zenn", "13:14", "Боул с лососем", 572, false, 32, 21, 60],
    ["zenn", "08:40", "Овсянка с ягодами", 338, false, 11, 8, 54],
    ["kairo", "08:34", "Овсянка с ягодами", 348, true, 11, 16, 46],
    ["mirage", "08:07", "Овсянка с ягодами", 343, true, 11, 8, 56],
  ],
  [
    ["kairo", "21:03", "Рыба с картофелем", 475, true],
    ["mirage", "20:26", "Гречка с индейкой", 515, true],
    ["frost", "19:55", "Стейк с овощами", 582, true],
    ["zenn", "19:46", "Рыба с картофелем", 516, false],
    ["vexa", "19:11", "Рыба с картофелем", 477, false],
    ["vexa", "16:57", "Банан и орехи", 310, true],
    ["mirage", "16:56", "Протеиновый батончик", 192, true],
    ["frost", "16:41", "Протеиновый батончик", 203, false],
    ["mirage", "14:59", "Курица с рисом", 529, true],
    ["frost", "14:30", "Салат Цезарь", 472, false],
    ["kairo", "14:26", "Боул с лососем", 518, true],
    ["vexa", "13:45", "Боул с лососем", 526, true],
    ["vexa", "09:25", "Омлет с овощами", 416, true],
    ["mirage", "09:03", "Овсянка с ягодами", 331, true],
    ["zenn", "08:36", "Овсянка с ягодами", 326, false],
  ],
  [
    ["vexa", "20:55", "Стейк с овощами", 619, true],
    ["frost", "20:40", "Рыба с картофелем", 504, true],
    ["zenn", "20:34", "Рыба с картофелем", 474, false],
    ["kairo", "20:02", "Гречка с индейкой", 432, false],
    ["mirage", "19:24", "Стейк с овощами", 651, false],
    ["vexa", "16:17", "Банан и орехи", 304, true],
    ["frost", "14:19", "Паста болоньезе", 728, true],
    ["mirage", "14:11", "Суп с фрикадельками", 359, false],
    ["vexa", "13:55", "Курица с рисом", 569, true],
    ["zenn", "13:34", "Паста болоньезе", 754, false],
    ["kairo", "13:15", "Суп с фрикадельками", 334, false],
    ["zenn", "09:32", "Омлет с овощами", 379, false],
    ["vexa", "08:21", "Омлет с овощами", 402, true],
  ],
];

// The reference deliberately uses warm placeholders, not actual food photos.
// Keep this example feed separate from imported observations and personal records.
export function createTeamMeals(today: Date): Meal[] {
  return Array.from({ length: 7 }, (_, ago) => {
    const date = dateKey(dateOffset(today, -ago));
    const seeds: Seed[] = recentMeals[ago] ?? staffPlayers.flatMap((player, index) => [
      [player.id, `20:${String(12 + index * 7).padStart(2, "0")}`, "Рыба с картофелем", 470 + index * 21 + ago * 3, (index + ago) % 3 !== 0],
      [player.id, `13:${String(10 + index * 8).padStart(2, "0")}`, "Курица с рисом", 510 + index * 14, (index + ago) % 2 === 0],
      [player.id, `08:${String(5 + index * 9).padStart(2, "0")}`, "Овсянка с ягодами", 320 + index * 7, index % 3 !== 0],
    ] as Seed[]);
    return seeds.map(([player, time, title, calories, photo, protein, fat, carbs], index) => ({
      id: `${date}:${player}:${index}`, player, date, time, title, calories, photo,
      protein: protein ?? Math.round(calories * .26 / 4),
      fat: fat ?? Math.round(calories * .3 / 9),
      carbs: carbs ?? Math.round(calories * .44 / 4),
    }));
  }).flat().sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

export function defaultNutritionPreferences(today: Date): NutritionPreferences {
  return { version: 1, player: "all", period: 3, photosOnly: false, day: dateKey(today), targets: Object.fromEntries(staffPlayers.map(p => [p.id, { calories: 2400, water: 2.5 }])) as Record<PlayerId, NutritionTarget> };
}
export function validTarget(target: NutritionTarget) { return Number.isInteger(target.calories) && target.calories >= 1 && target.calories <= 10000 && Number.isFinite(target.water) && target.water >= .1 && target.water <= 10; }
export function readNutritionPreferences(today: Date, raw?: string | null): NutritionPreferences {
  const fallback = defaultNutritionPreferences(today);
  try {
    const value = JSON.parse(raw === undefined ? localStorage.getItem(NUTRITION_STORAGE_KEY) ?? "null" : raw ?? "null");
    if (!value || value.version !== 1) return fallback;
    const period = [1, 3, 7].includes(value.period) ? value.period : 3;
    const start = dateKey(dateOffset(today, 1 - period));
    const day = typeof value.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.day) && dateKey(parseDate(value.day)) === value.day && value.day >= start && value.day <= fallback.day ? value.day : fallback.day;
    return { version: 1, period, day, player: value.player === "all" || staffPlayers.some(p => p.id === value.player) ? value.player : "all", photosOnly: value.photosOnly === true,
      targets: Object.fromEntries(staffPlayers.map(p => { const t = value.targets?.[p.id]; return [p.id, t && validTarget(t) ? { calories: t.calories, water: t.water } : fallback.targets[p.id]]; })) as Record<PlayerId, NutritionTarget> };
  } catch { return fallback; }
}
export function filterTeamMeals(meals: Meal[], prefs: NutritionPreferences, today: Date) {
  const start = dateKey(dateOffset(today, 1 - prefs.period)), end = dateKey(today);
  return meals.filter(m => m.date >= start && m.date <= end && (prefs.player === "all" || m.player === prefs.player) && (!prefs.photosOnly || m.photo));
}
export function dayNutrition(meals: Meal[], player: PlayerId, day: string, today: Date) {
  const rows = meals.filter(m => m.player === player && m.date === day);
  const sum = (key: "calories" | "protein" | "fat" | "carbs") => rows.reduce((total, meal) => total + meal[key], 0);
  const currentWater = { vexa: 1.8, frost: .9, kairo: 2.2, mirage: .6, zenn: 1.4 };
  const water = rows.length ? day === dateKey(today) ? currentWater[player] : Math.round((1.3 + staffPlayers.findIndex(p => p.id === player) * .2) * 10) / 10 : 0;
  return { count: rows.length, calories: sum("calories"), protein: sum("protein"), fat: sum("fat"), carbs: sum("carbs"), water };
}
export function dayLabel(day: string, today: Date, weekday = false) {
  const prefix = day === dateKey(today) ? "Сегодня, " : day === dateKey(dateOffset(today, -1)) ? "Вчера, " : "";
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", ...(weekday ? { weekday: "long" as const } : {}) }).format(parseDate(day));
  // Keep the same ordering as the reference: date first, then weekday.
  return prefix + (weekday ? `${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(parseDate(day))}, ${new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(parseDate(day))}` : date);
}
export const recordsLabel = (count: number) => `${count} ${{ one: "запись", few: "записи", many: "записей", other: "записи", zero: "записей", two: "записи" }[new Intl.PluralRules("ru-RU").select(count)]}`;
export const mealsLabel = (count: number) => `${count} ${{ one: "приём пищи", few: "приёма пищи", many: "приёмов пищи", other: "приёма пищи", zero: "приёмов пищи", two: "приёма пищи" }[new Intl.PluralRules("ru-RU").select(count)]}`;
