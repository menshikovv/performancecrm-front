import { dateKey, dateOffset, mean, parseDate } from "../overview/overview-data";
import { createDemoCheckins } from "../mood/mood-data";

export type TestKey = "visual" | "go" | "back" | "stroop" | "span";
export type AttemptStatus = "counted" | "calibration" | "excluded";
export type DaySlot = "morning" | "afternoon" | "evening";
export interface Outcome { correct: number; total: number; reactionMs: number | null }
export interface Attempt extends Outcome { id: string; test: TestKey; date: string; createdAt: string; score: number; status: AttemptStatus }
export interface CheckIn { date: string; slot: DaySlot; mood: number; energy: number; note: string }
export interface GameSurvey { id: string; date: string; timing: "before" | "after"; wellbeing: number; concentration: number; fatigue: number; note: string }
export interface WeeklyReview { week: string; balance: number[]; wins: string; challenge: string; plan: string; savedAt: string }
export interface TestsStore { version: 1; attempts: Attempt[]; checkins: CheckIn[]; surveys: GameSurvey[]; weekly: WeeklyReview[]; trendOpen: boolean; historyOpen: boolean }
export const TESTS_STORAGE_KEY = "performance-tests:v1";
export const tests: Array<{ key: TestKey; name: string; description: string; instruction: string; hint: string }> = [
  { key: "visual", name: "Visual Search", description: "Внимание и скорость поиска", instruction: "Найдите букву F среди букв E. Нажимайте на неё как можно быстрее. Впереди 8 коротких раундов.", hint: "Найдите и нажмите F" },
  { key: "go", name: "Go / No-Go", description: "Реакция и самоконтроль", instruction: "Нажимайте кнопку или пробел, когда видите синий круг. На оранжевый круг не реагируйте. Будет 12 сигналов, каждый длится 1,2 секунды.", hint: "Синий — нажать. Оранжевый — пропустить." },
  { key: "back", name: "2-Back", description: "Рабочая память", instruction: "Сравнивайте символ с тем, который был два шага назад. Первые два символа запомните. Затем выбирайте «Совпадает» или «Не совпадает». Клавиши F и J тоже работают.", hint: "Совпадает с символом два шага назад?" },
  { key: "stroop", name: "Stroop Switch", description: "Переключение и помехоустойчивость", instruction: "Следите за правилом над словом. В одних раундах выбирайте цвет текста, в других — значение слова. Ответьте в 10 раундах. Можно использовать клавиши 1–4.", hint: "Сначала прочитайте правило, затем выберите ответ." },
  { key: "span", name: "Spatial Span", description: "Пространственная память", instruction: "Запомните порядок подсвеченных клеток и повторите его. Будет три последовательности: из 3, 4 и 5 клеток. Можно нажимать клетки или клавиши 1–9.", hint: "Запомните последовательность клеток." },
];
export const slotLabels: Record<DaySlot, string> = { morning: "Утро", afternoon: "День", evening: "Вечер" };
export const statusLabels: Record<AttemptStatus, string> = { counted: "В зачёте", calibration: "Калибровка", excluded: "Исключено" };
export const balanceLabels = ["Сон", "Энергия", "Игровая форма", "Уверенность", "Режим", "Эмоции", "Общение", "Восстановление"];
export function weekKey(date: Date) { return dateKey(dateOffset(date, -((date.getDay() + 6) % 7))); }
export function makeAttempt(test: TestKey, outcome: Outcome, previous: Attempt[], now = new Date()): Attempt {
  const accuracy = outcome.total ? outcome.correct / outcome.total : 0;
  const speed = outcome.reactionMs === null ? accuracy : Math.max(0, Math.min(1, (1800 - outcome.reactionMs) / 1500));
  const validPrevious = previous.filter(item => item.test === test && item.status !== "excluded").length;
  return { ...outcome, id: crypto.randomUUID(), test, date: dateKey(now), createdAt: now.toISOString(), score: Math.round((accuracy * .8 + speed * .2) * 100), status: accuracy < .6 ? "excluded" : validPrevious < 2 ? "calibration" : "counted" };
}
export function latestAttempts(attempts: Attempt[]) { return tests.flatMap(test => { const latest = attempts.filter(item => item.test === test.key).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; return latest ? [latest] : []; }); }
export function dailyCompletion(store: TestsStore, date: string) { return new Set(store.attempts.filter(item => item.date === date).map(item => item.test)); }
export function dayIndex(store: TestsStore, date: string): number | null { const valid = latestAttempts(store.attempts.filter(item => item.date === date && item.status === "counted")); return valid.length ? Math.round(mean(valid.map(item => item.score))) : null; }
export function createTestsStore(today = new Date()): TestsStore {
  const attempt = (test: TestKey, score: number, offset: number, index: number, status: AttemptStatus = "counted"): Attempt => ({ id: `demo-${test}-${offset}-${index}`, test, date: dateKey(dateOffset(today, offset)), createdAt: new Date(dateOffset(today, offset).setHours(12, index, 0, 0)).toISOString(), correct: Math.round(score / 10), total: 10, reactionMs: 450 + (100 - score) * 5, score, status });
  const attempts = tests.flatMap((test, index) => [-7, -6, -5].map((offset, round) => attempt(test.key, 65 + index + round * 2, offset, index)));
  for (const [offset, score] of [[-6, 68], [-5, 72], [-3, 61], [-2, 47], [-1, 74]] as const) attempts.push(...tests.map((test, index) => attempt(test.key, score, offset, 10 + index)));
  attempts.push(attempt("visual", 74, -1, 30), attempt("go", 81, -1, 31), attempt("back", 58, -2, 32, "calibration"), attempt("stroop", 42, -2, 33, "excluded"), attempt("span", 66, -2, 34));
  // Keep the latest per-test history aligned with the sample statuses.
  const history = tests.map(test => attempts.filter(item => item.test === test.key).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]);
  return { version: 1, attempts: [...attempts.filter(item => !["back", "stroop", "span"].includes(item.test) || item.date < dateKey(dateOffset(today, -2))), ...history.filter(item => ["back", "stroop", "span"].includes(item.test)).map((item): Attempt => ({ ...item, date: dateKey(dateOffset(today, -1)), createdAt: new Date(dateOffset(today, -1).setHours(12, 40 + tests.findIndex(test => test.key === item.test), 0, 0)).toISOString(), score: item.test === "back" ? 58 : item.test === "stroop" ? 42 : 66, status: item.test === "back" ? "calibration" : item.test === "stroop" ? "excluded" : "counted" }))], checkins: createDemoCheckins(today), surveys: [
    { id: "demo-game-1", date: dateKey(today), timing: "before", wellbeing: 7, concentration: 8, fatigue: 3, note: "" },
    { id: "demo-game-2", date: dateKey(dateOffset(today, -1)), timing: "after", wellbeing: 6, concentration: 10, fatigue: 7, note: "" },
    { id: "demo-game-3", date: dateKey(dateOffset(today, -1)), timing: "before", wellbeing: 8, concentration: 7, fatigue: 2, note: "" },
    { id: "demo-game-4", date: dateKey(dateOffset(today, -6)), timing: "after", wellbeing: 5, concentration: 4, fatigue: 10, note: "" },
    { id: "demo-game-5", date: dateKey(dateOffset(today, -6)), timing: "before", wellbeing: 7, concentration: 7, fatigue: 4, note: "" },
  ], weekly: [], trendOpen: true, historyOpen: true };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const dateValid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDate(value)) === value;
const number = (value: unknown, max = 10) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
export function readTestsStore(now = new Date()): TestsStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TESTS_STORAGE_KEY) || "null");
    if (!record(parsed) || parsed.version !== 1 || !Array.isArray(parsed.attempts) || !Array.isArray(parsed.checkins) || !Array.isArray(parsed.surveys) || !Array.isArray(parsed.weekly)) return createTestsStore(now);
    if (!parsed.attempts.every(item => record(item) && typeof item.id === "string" && tests.some(test => test.key === item.test) && dateValid(item.date) && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) && number(item.score, 100) && number(item.total, 1000) && (item.total as number) > 0 && number(item.correct, item.total as number) && (item.reactionMs === null || number(item.reactionMs, 1e9)) && typeof item.status === "string" && Object.hasOwn(statusLabels, item.status))) return createTestsStore(now);
    if (!parsed.checkins.every(item => record(item) && dateValid(item.date) && typeof item.slot === "string" && Object.hasOwn(slotLabels, item.slot) && number(item.mood) && number(item.energy) && typeof item.note === "string")) return createTestsStore(now);
    if (!parsed.surveys.every(item => record(item) && typeof item.id === "string" && dateValid(item.date) && ["before", "after"].includes(String(item.timing)) && number(item.wellbeing) && number(item.concentration) && number(item.fatigue) && typeof item.note === "string")) return createTestsStore(now);
    if (!parsed.weekly.every(item => record(item) && dateValid(item.week) && Array.isArray(item.balance) && item.balance.length === 8 && item.balance.every(value => number(value)) && typeof item.wins === "string" && typeof item.challenge === "string" && typeof item.plan === "string" && typeof item.savedAt === "string")) return createTestsStore(now);
    return { ...(parsed as unknown as TestsStore), trendOpen: parsed.trendOpen !== false, historyOpen: parsed.historyOpen !== false };
  } catch { return createTestsStore(now); }
}
