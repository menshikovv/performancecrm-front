import { dateKey, dateOffset, mean, parseDate } from "../overview/overview-data";
import { PlayerId, StaffRecord, StaffStore, createStaffStore, metricValue, staffPlayers } from "../overview/staff-data";

export const PLAYERS_STORAGE_KEY = "performance-staff-players:v1";
export const playerTabs = { profile: "Профиль", tests: "Тесты", game: "Игра", correlations: "Корреляции", balance: "Колесо баланса", nutrition: "Питание", sleep: "Сон" } as const;
export type PlayerTab = keyof typeof playerTabs;
export const testTypes = { all: "Все тесты", visual: "Visual Search", go: "Go / No-Go", back: "2-Back", stroop: "Stroop Switch", span: "Spatial Span" } as const;
export type TestFilter = keyof typeof testTypes;
export const gameSources = { all: "Все", practice: "Пракк", faceit: "FACEIT", tournament: "Турнир" } as const;
export type GameSource = Exclude<keyof typeof gameSources, "all">;
export type AssetKind = "communication" | "roadmap" | "mindmap";
export const assetLabels: Record<AssetKind, string> = { communication: "Схема общения", roadmap: "Roadmap", mindmap: "Mindmap" };
export type PlayerAsset = { name: string; data: string; updatedAt: string };
export type Contacts = { telegram: string; faceit: string; steam: string };
export type PlayerNotes = { text: string; updatedAt: string | null; assets: Partial<Record<AssetKind, PlayerAsset>>; contacts: Contacts };
export type PlayersPreferences = { version: 1; selected: PlayerId; period: 7 | 30 | 90; mode: "roster" | "nutrition"; tab: PlayerTab; test: TestFilter; source: keyof typeof gameSources; notes: Record<PlayerId, PlayerNotes> };
export type PlayerDay = StaffRecord & { scores: Record<Exclude<TestFilter, "all">, number | null>; focus: number | null; fatigue: number | null; screen: number | null; source: GameSource; balance: number[] };
export const playerBios: Record<PlayerId, { role: string; secondary: string; side: string; phase: string; archetype: string; description: string; traits: string[]; activity: string }> = {
  vexa: { role: "IGL", secondary: "Support", side: "CT-side", phase: "Mid-round", archetype: "Холодный аналитик", description: "Сильнее всего там, где нужен расчёт и чтение ситуации. Раскрывается в игре с ясной логикой и дисциплиной.", traits: ["Структурный", "Читает игру", "Держит контур"], activity: "09:00" },
  frost: { role: "AWP", secondary: "Rifler", side: "CT-side", phase: "Opening", archetype: "Точный наблюдатель", description: "Выбирает момент для первого контакта. Лучше действует, когда команда заранее проговорила темп и пространство.", traits: ["Точность", "Терпение", "Первый контакт"], activity: "23:40" },
  kairo: { role: "Entry", secondary: "Rifler", side: "T-side", phase: "Execute", archetype: "Инициатор", description: "Берёт первый контакт и создаёт пространство. Нуждается в понятной поддержке и синхронном выходе партнёров.", traits: ["Темп", "Инициатива", "Создаёт пространство"], activity: "13:34" },
  mirage: { role: "Support", secondary: "IGL", side: "CT-side", phase: "Retake", archetype: "Командный связующий", description: "Помогает партнёрам выходить на удобные позиции. Сильная сторона — согласование гранат, обмена и следующего действия.", traits: ["Взаимодействие", "Поддержка", "Дисциплина"], activity: "15:51" },
  zenn: { role: "Lurker", secondary: "Rifler", side: "T-side", phase: "Late-round", archetype: "Искатель момента", description: "Собирает информацию и находит окно для позднего действия. Стабильнее играет с ясными сигналами от команды.", traits: ["Информация", "Тайминг", "Самостоятельность"], activity: "17:08" },
};
export const balanceNames = ["Здоровье", "Эмоции", "Интеллект", "Развитие", "Карьера", "Отношения", "Окружение", "Финансы"];
export function defaultPlayersPreferences(): PlayersPreferences { return { version: 1, selected: "vexa", period: 30, mode: "roster", tab: "profile", test: "all", source: "all", notes: Object.fromEntries(staffPlayers.map(player => [player.id, { text: player.id === "vexa" ? "Главный канал в команде. С frost — открытый вопрос по таймингам на B, обсудить на разборе." : "", updatedAt: null, assets: {}, contacts: { telegram: "", faceit: "", steam: "" } }])) as Record<PlayerId, PlayerNotes> }; }
export function validAsset(value: unknown): value is PlayerAsset { if (!value || typeof value !== "object") return false; const a = value as PlayerAsset; return typeof a.name === "string" && a.name.length <= 120 && typeof a.data === "string" && a.data.length <= 600000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.data) && typeof a.updatedAt === "string" && Number.isFinite(Date.parse(a.updatedAt)); }
export function validContact(kind: keyof Contacts, value: string) {
  if (!value.trim()) return true;
  try { const url = new URL(value.trim()); const hosts = { telegram: ["t.me"], faceit: ["faceit.com", "www.faceit.com"], steam: ["steamcommunity.com", "www.steamcommunity.com"] }; return url.protocol === "https:" && hosts[kind].includes(url.hostname.toLowerCase()) && !url.username && !url.password && !url.port && !url.search && !url.hash && (kind === "telegram" ? /^\/[A-Za-z0-9_]{3,64}\/?$/.test(url.pathname) : kind === "faceit" ? /^\/(?:[a-z]{2}\/)?players\/[^/]+\/?$/.test(url.pathname) : /^\/(?:id|profiles)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)); } catch { return false; }
}
export function readPlayersPreferences(raw?: string | null): PlayersPreferences {
  const fallback = defaultPlayersPreferences();
  try {
    const value = JSON.parse(raw === undefined ? localStorage.getItem(PLAYERS_STORAGE_KEY) ?? "null" : raw ?? "null"); if (!value || value.version !== 1) return fallback;
    const notes = Object.fromEntries(staffPlayers.map(player => { const n = value.notes?.[player.id]; return [player.id, { text: typeof n?.text === "string" ? n.text.slice(0, 5000) : fallback.notes[player.id].text, updatedAt: typeof n?.updatedAt === "string" && Number.isFinite(Date.parse(n.updatedAt)) ? n.updatedAt : null, assets: Object.fromEntries(Object.keys(assetLabels).flatMap(kind => validAsset(n?.assets?.[kind]) ? [[kind, n.assets[kind]]] : [])), contacts: Object.fromEntries((["telegram", "faceit", "steam"] as const).map(kind => [kind, typeof n?.contacts?.[kind] === "string" && n.contacts[kind].length <= 500 && validContact(kind, n.contacts[kind]) ? n.contacts[kind] : ""])) as Contacts }]; })) as Record<PlayerId, PlayerNotes>;
    return { version: 1, selected: staffPlayers.some(p => p.id === value.selected) ? value.selected : "vexa", period: [7, 30, 90].includes(value.period) ? value.period : 30, mode: value.mode === "nutrition" ? "nutrition" : "roster", tab: Object.hasOwn(playerTabs, value.tab) ? value.tab : "profile", test: Object.hasOwn(testTypes, value.test) ? value.test : "all", source: Object.hasOwn(gameSources, value.source) ? value.source : "all", notes };
  } catch { return fallback; }
}
const round = (value: number) => Math.round(value * 100) / 100;
export function buildPlayerDays(today = new Date(), shared: StaffStore = createStaffStore(today)): PlayerDay[] {
  const overlays = new Map(shared.records.map(record => [`${record.player}:${record.date}`, record]));
  const firstSharedDate = shared.records.reduce((first, row) => row.date < first ? row.date : first, dateKey(dateOffset(today, -13)));
  return staffPlayers.flatMap((player, p) => Array.from({ length: 180 }, (_, i) => {
    const ago = 179 - i; const t = i + p * 7; const date = dateKey(dateOffset(today, -ago));
    const cognitive = Math.max(30, Math.min(94, 66 + p * 2 + 9 * Math.sin(t * .27)));
    const base: StaffRecord = { player: player.id, date, mood: round(5.8 + Math.sin(t * .24) * 1.3 + p * .15), sleep: round(7.1 + Math.sin(t * .3) * .9 + p * .08), energy: round(6 + Math.cos(t * .25) * 1.1), readiness: Math.round(70 + Math.sin(t * .32) * 14 + p), cognitive: round(cognitive), kills: 16 + (i + p) % 15, deaths: 15 + (i * 3 + p) % 12, wins: (i + p) % 4 < 2 ? 1 : 0, maps: 1, nutrition: 2150 + (i * 37 + p * 61) % 600 };
    const overlay = overlays.get(`${player.id}:${date}`); const record = overlay ?? base;
    // Existing Staff observations are authoritative in their stored 14-day window,
    // including deliberately missing rows. Older periods are extended demo history.
    const sharedWindow = date >= firstSharedDate;
    const known = overlay || !sharedWindow;
    const values = known ? record : { ...record, mood: null, sleep: null, energy: null, readiness: null, cognitive: null, kills: null, deaths: null, wins: null, maps: null, nutrition: null };
    const score = (delta: number) => values.cognitive === null ? null : round(Math.max(0, Math.min(100, values.cognitive + delta + Math.sin(t * .41) * 2)));
    return { ...values, scores: { visual: score(6), go: score(10), back: score(-4), stroop: score(-10), span: score(0) }, focus: known ? 6 + (i + p) % 4 : null, fatigue: known ? 2 + (i * 2 + p) % 6 : null, screen: known ? round(5.5 + Math.sin(t * .12) * 1.4) : null, source: (["practice", "faceit", "tournament"] as const)[(i + p) % 3], balance: Array.from({ length: 8 }, (_, n) => round(Math.max(1, Math.min(10, 6 + Math.sin(p + n + Math.floor(i / 7) * .3) * 2.3)))) };
  }));
}
export function cognitiveValue(day: PlayerDay, filter: TestFilter) { if (filter !== "all") return day.scores[filter]; const values = Object.values(day.scores).filter((v): v is number => v !== null); return values.length ? mean(values) : null; }
export function conditionValue(day: PlayerDay) { return day.mood !== null && day.energy !== null ? (day.mood + day.energy) * 5 : null; }
export function playerRange(days: PlayerDay[], selected: PlayerId, period: number, today: Date) { const start = dateKey(dateOffset(today, 1 - period)); const end = dateKey(today); return days.filter(day => day.player === selected && day.date >= start && day.date <= end); }
export function playerSummary(days: PlayerDay[], selected: PlayerId, period: number, today: Date, test: TestFilter) {
  const current = playerRange(days, selected, period, today); const previous = playerRange(days, selected, period, dateOffset(today, -period));
  const average = (rows: PlayerDay[], fn: (row: PlayerDay) => number | null) => { const known = rows.map(fn).filter((n): n is number => n !== null); return known.length ? mean(known) : null; };
  const score = average(current, row => cognitiveValue(row, test)); const oldScore = average(previous, row => cognitiveValue(row, test)); const condition = average(current, conditionValue); const oldCondition = average(previous, conditionValue);
  return { current, previous, score, condition, scoreDelta: score !== null && oldScore !== null ? score - oldScore : null, conditionDelta: condition !== null && oldCondition !== null ? condition - oldCondition : null, focus: current.filter(d => d.focus !== null && d.focus >= 8).length, fatigue: current.filter(d => d.fatigue !== null && d.fatigue >= 8).length };
}
export function readinessStatus(value: number | null) { return value === null ? { label: "Нет данных", tone: "empty" } : value >= 70 ? { label: "Готов", tone: "ready" } : value >= 55 ? { label: "Под вопросом", tone: "question" } : { label: "Риск", tone: "risk" }; }
export function gameRows(rows: PlayerDay[], source: keyof typeof gameSources) { return rows.filter(row => source === "all" || row.source === source); }
export function gameSummary(rows: PlayerDay[]) { return { kd: metricValue(rows, "kd"), winrate: metricValue(rows, "winrate"), maps: rows.reduce((sum, row) => sum + (row.maps ?? 0), 0) }; }
export function pearsonPairs(rows: PlayerDay[], test: TestFilter) { const pairs = rows.flatMap(row => { const cognitive = cognitiveValue(row, test); return row.sleep !== null && cognitive !== null ? [{ date: row.date, x: row.sleep, y: cognitive }] : []; }); if (pairs.length < 5) return { pairs, r: null }; const x = mean(pairs.map(p=>p.x)), y = mean(pairs.map(p=>p.y)); const xx = pairs.reduce((s,p)=>s+(p.x-x)**2,0), yy = pairs.reduce((s,p)=>s+(p.y-y)**2,0); return { pairs, r: xx && yy ? Math.max(-1, Math.min(1, pairs.reduce((s,p)=>s+(p.x-x)*(p.y-y),0)/Math.sqrt(xx*yy))) : null }; }
export const formatNumber = (value: number | null, digits = 1) => value === null ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
export const shortDate = (date: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(parseDate(date));
