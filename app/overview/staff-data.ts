import { dateKey, dateOffset, mean, parseDate, weekDates } from "./overview-data";

export const STAFF_STORAGE_KEY = "performance-staff-overview:v1";
export const staffPlayers = [
  { id: "vexa", name: "vexa", position: "Капитан · IGL" },
  { id: "frost", name: "frost", position: "Снайпер · AWP" },
  { id: "kairo", name: "Kairo", position: "Рифлер · Entry" },
  { id: "mirage", name: "m1rage", position: "Рифлер · Support" },
  { id: "zenn", name: "zeNN", position: "Рифлер · Lurker" },
] as const;
export type PlayerId = typeof staffPlayers[number]["id"];
export type StaffGroup = "state" | "sleep" | "nutrition" | "game";
export type StaffMetric = "mood" | "sleep" | "energy" | "readiness" | "cognitive" | "kd" | "winrate" | "nutrition";
export type StaffRecord = { player: PlayerId; date: string; mood: number | null; sleep: number | null; energy: number | null; readiness: number | null; cognitive: number | null; kills: number | null; deaths: number | null; wins: number | null; maps: number | null; nutrition: number | null };
export type StaffStore = { version: 1; records: StaffRecord[]; player: PlayerId | "team"; widgets: StaffGroup[]; readNotifications: string[]; completedSteps: Record<string, number[]> };
export const staffLabels: Record<StaffMetric, string> = { mood: "Настроение", sleep: "Сон и энергия", energy: "Энергия", readiness: "Готовность", cognitive: "Когнитивная форма", kd: "K/D", winrate: "Win-rate", nutrition: "Питание" };
export const staffGroups: Record<StaffGroup, string> = { state: "Состояние", sleep: "Сон", nutrition: "Питание", game: "Игра" };
export const strategies = [
  { id: "mirage-a", title: "Mirage · выход на A", map: "Mirage", description: "Командный разбор стандартного выхода и распределения ролей.", steps: ["Проверить роли и время выхода", "Повторить смоки CT, jungle и stairs на тренировочном сервере", "Согласовать флешки и выход первого номера", "Разобрать запись тренировочного раунда"] },
  { id: "inferno-b", title: "Inferno · контроль banana", map: "Inferno", description: "Подготовка к первому контакту и обмену в паре.", steps: ["Распределить пары и стартовые позиции", "Проверить тайминги гранат на тренировке", "Отработать обмен и отход", "Записать выводы после прака"] },
  { id: "nuke-retake", title: "Nuke · ретейки", map: "Nuke", description: "Взаимодействие в ретейке без лишних одиночных дуэлей.", steps: ["Выбрать точку входа и ведущего игрока", "Согласовать совместную флешку", "Повторить перекрёстную проверку позиций", "Сравнить два сыгранных раунда"] },
];
export const staffNotifications = [
  { id: "weekly-report", title: "Недельный обзор готов", message: "Сводка за семь дней доступна для всей команды и каждого игрока." },
  { id: "team-calendar", title: "Проверьте командное расписание", message: "Тренировки и матчи находятся в календаре команды." },
  { id: "practice-materials", title: "Материалы к тренировке", message: "В библиотеке есть три демонстрационных плана командной работы." },
];
const round = (n: number) => Math.round(n * 100) / 100;
export function createStaffStore(today = new Date()): StaffStore {
  const records = staffPlayers.flatMap((player, p) => Array.from({ length: 14 }, (_, index): StaffRecord => {
    const day = index % 7; const previous = index < 7; const offset = p - 2;
    return { player: player.id, date: dateKey(dateOffset(today, index - 13)), mood: round((day < 5 ? 6.1 : 5.4) + offset * .05 + (previous ? .2 : 0)), sleep: round([7.1, 7.2, 7.2, 7.0, 6.8, 7, 7.05][day] + offset * .1 + (previous ? .15 : 0)), energy: round([5.9, 6, 6, 5.5, 5.9, 5.7, 6.3][day] + offset * .3 + (previous ? .3 : 0)), readiness: [71, 76, 76, 67, 62, 67, 69][day] + offset * 4 + (previous ? 6 : 0), cognitive: [63, 64, 67, 58, 55, 59, 61][day] + offset * 3 + (previous ? 2 : 0), kills: [22, 22, 20, 20, 18, 21, 19][day] + offset + (previous ? 1 : 0), deaths: 20, wins: [12, 11, 10, 11, 8, 11, 8][day] + offset + (previous && day < 4 ? 1 : 0), maps: 20, nutrition: [2250, 2380, 2410, 2290, 2180, 2340, 2310][day] + offset * 90 + (previous ? -80 : 0) };
  }));
  return { version: 1, records, player: "team", widgets: ["state", "sleep", "game"], readNotifications: [], completedSteps: {} };
}
function validDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDate(value)) === value; }
function validRecord(value: unknown): value is StaffRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  if (!staffPlayers.some(player => player.id === r.player) || !validDate(r.date)) return false;
  const limits = { mood: 10, sleep: 24, energy: 10, readiness: 100, cognitive: 100, kills: 9999, deaths: 9999, wins: 999, maps: 999, nutrition: 15000 };
  for (const [key, max] of Object.entries(limits)) { const v = r[key]; if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max || (["kills", "deaths", "wins", "maps"].includes(key) && !Number.isInteger(v)))) return false; }
  return r.wins === null || r.maps === null || (r.wins as number) <= (r.maps as number);
}
export function readStaffStore(today = new Date(), raw?: string | null): StaffStore {
  const fallback = createStaffStore(today);
  try {
    const value = JSON.parse(raw === undefined ? localStorage.getItem(STAFF_STORAGE_KEY) ?? "null" : raw ?? "null");
    if (!value || value.version !== 1 || !Array.isArray(value.records)) return fallback;
    const records = value.records.filter(validRecord).slice(-5000).filter((item: StaffRecord, index: number, all: StaffRecord[]) => all.findIndex(other => other.player === item.player && other.date === item.date) === index);
    const completedSteps = Object.fromEntries(strategies.map(strategy => [strategy.id, Array.isArray(value.completedSteps?.[strategy.id]) ? [...new Set(value.completedSteps[strategy.id].filter((step: unknown) => typeof step === "number" && Number.isInteger(step) && step >= 0 && step < strategy.steps.length))] as number[] : []]));
    return { version: 1, records, player: value.player === "team" || staffPlayers.some(player => player.id === value.player) ? value.player : "team", widgets: Array.isArray(value.widgets) ? [...new Set(value.widgets.filter((key: unknown) => typeof key === "string" && Object.hasOwn(staffGroups, key)))] as StaffGroup[] : fallback.widgets, readNotifications: Array.isArray(value.readNotifications) ? value.readNotifications.filter((id: unknown) => staffNotifications.some(item => item.id === id)) : [], completedSteps };
  } catch { return fallback; }
}
export function metricValue(records: StaffRecord[], metric: StaffMetric): number | null {
  if (metric === "kd") { const known = records.filter(r => r.kills !== null && r.deaths !== null); const deaths = known.reduce((sum, r) => sum + r.deaths!, 0); return deaths ? known.reduce((sum, r) => sum + r.kills!, 0) / deaths : null; }
  if (metric === "winrate") { const known = records.filter(r => r.wins !== null && r.maps !== null && r.maps > 0); const maps = known.reduce((sum, r) => sum + r.maps!, 0); return maps ? known.reduce((sum, r) => sum + r.wins!, 0) / maps * 100 : null; }
  const known = records.map(r => r[metric]).filter((v): v is number => v !== null);
  return known.length ? mean(known) : null;
}
export function staffSummary(store: StaffStore, today = new Date()) {
  const dates = weekDates(today); const previousDates = weekDates(dateOffset(today, -7));
  const scoped = store.records.filter(record => store.player === "team" || record.player === store.player);
  const current = scoped.filter(record => dates.includes(record.date)); const previous = scoped.filter(record => previousDates.includes(record.date));
  const series = (metric: StaffMetric) => dates.map(date => metricValue(current.filter(r => r.date === date), metric));
  return { dates, current, previous, series, value: (metric: StaffMetric) => metricValue(current, metric), delta: (metric: StaffMetric) => { const now = metricValue(current, metric); const before = metricValue(previous, metric); return now !== null && before !== null ? now - before : null; } };
}
export function formatStaff(value: number | null, metric: StaffMetric) {
  if (value === null) return "—";
  const digits = ["mood", "energy"].includes(metric) ? 1 : metric === "kd" ? 2 : 0;
  if (metric === "sleep") { const minutes = Math.round(value * 60); return `${Math.floor(minutes / 60)}ч ${String(minutes % 60).padStart(2, "0")}м`; }
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value) + (metric === "winrate" ? "%" : metric === "nutrition" ? " ккал" : "");
}
export function staffStatus(value: number | null, metric: StaffMetric) {
  if (value === null) return { label: "Нет данных", tone: "empty" };
  const scaled = metric === "kd" ? value * 6 : metric === "winrate" ? value / 10 : ["readiness", "cognitive"].includes(metric) ? value / 10 : metric === "nutrition" ? 6 : value;
  return scaled >= 8 ? { label: "Отлично", tone: "good" } : scaled >= 4 ? { label: "Средне", tone: "medium" } : { label: "Плохо", tone: "poor" };
}
