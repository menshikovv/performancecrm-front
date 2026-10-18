import { dateKey, dateOffset, parseDate } from "../overview/overview-data";

export const STRATEGIES_STORAGE_KEY = "performance-strategies:v1";
export const maps = ["Mirage", "Inferno", "Nuke", "Ancient", "Anubis", "Dust2", "Train"] as const;
export type GameMap = typeof maps[number];
export const materialTypes = { smoke: "Смок", flash: "Флешка", molotov: "Молотов", he: "HE", script: "Скрипт" } as const;
export type MaterialType = keyof typeof materialTypes;
export type Side = "T" | "CT";
export type Material = { id: string; title: string; map: GameMap; type: MaterialType; side: Side; description: string; steps: string[]; script: string; video: string; demoVideo: boolean; author: string; createdAt: string; updatedAt: string; favorite: boolean; completed: number[] };
export type MaterialFilters = { search: string; map: GameMap | "all"; type: MaterialType | "all"; side: Side | "all"; favorites: boolean };
export type StrategiesStore = { version: 1; materials: Material[]; filters: MaterialFilters; selected: string | null };
export type MaterialDraft = Pick<Material, "title" | "map" | "type" | "side" | "description" | "script" | "video"> & { steps: string };
export const defaultFilters = (): MaterialFilters => ({ search: "", map: "all", type: "all", side: "all", favorites: false });
export const emptyDraft = (type: MaterialType = "smoke"): MaterialDraft => ({ title: "", map: "Mirage", type, side: "T", description: "", steps: "", script: "", video: "" });

export function createStrategiesStore(today = new Date()): StrategiesStore {
  const seed: [string, string, GameMap, MaterialType, Side, string, number, boolean, boolean, string[]][] = [
    ["mirage-window", "Смок в окно с T-спавна", "Mirage", "smoke", "T", "Coach", 2, true, true, ["Встать в угол у ящика на T-спавне", "Прицел на верхний край антенны", "Прыжок с броском (jumpthrow)"]],
    ["mirage-flash", "Флешка на выход B-апартаментов", "Mirage", "flash", "T", "vexa", 3, false, false, ["Занять позицию в B-апартаментах вместе с первым номером", "Согласовать момент выхода и предупредить партнёров", "Дать флешку за стену перед совместным выходом"]],
    ["inferno-molotov", "Молотов в дарк на банане", "Inferno", "molotov", "CT", "Coach", 4, true, true, ["Занять стартовую позицию у банана", "Проверить траекторию на тренировочном сервере", "Согласовать бросок с флешкой партнёра"]],
    ["inferno-default", "Дефолт B-сайт Inferno", "Inferno", "script", "T", "Coach", 5, false, false, ["Распределить игроков на контроль банана и мида", "Собрать информацию и сохранить гранаты под выход", "По сигналу капитана синхронно занять плент B", "После установки бомбы играть обмен и контроль подходов"]],
    ["nuke-outside", "Смок на outside", "Nuke", "smoke", "T", "Blitz", 6, true, false, ["Определить роль в линии смоков на улице", "На тренировке проверить отсутствие щелей", "Переходить к secret только по командному сигналу"]],
    ["ancient-retake", "Ретейк A Ancient", "Ancient", "script", "CT", "Coach", 6, false, true, ["Дождаться партнёров и назвать оставшиеся гранаты", "Выбрать общий момент входа с двух направлений", "Согласовать флешку, проверить ближние позиции", "Отдать размен и прикрыть разминирование"]],
    ["ancient-flash", "Флешка на A-мейн", "Ancient", "flash", "T", "m1rage", 8, false, false, ["Уточнить позицию первого игрока на A-мейне", "Предупредить команду перед броском", "Выйти вместе с партнёром после взрыва флешки"]],
    ["anubis-he", "HE в бокс на B", "Anubis", "he", "T", "Kairo", 9, false, false, ["Проверить наличие игрока за боксом по информации команды", "На тренировке выбрать точку броска", "Дать HE и подготовиться к обмену"]],
    ["dust2-cross", "Смок CT-кросс", "Dust2", "smoke", "T", "Coach", 11, true, false, ["Согласовать смок перед выходом на A", "Проверить перекрытие CT-кросса на тренировке", "Переходить с готовым разменом и контролем рампы"]],
    ["train-molotov", "Молотов на ивент", "Train", "molotov", "CT", "frost", 14, false, false, ["Собрать информацию о выходе соперника", "Согласовать молотов с партнёром по точке", "После броска сменить позицию и держать размен"]],
  ];
  const materials = seed.map(([id, title, map, type, side, author, ago, demoVideo, favorite, steps]): Material => {
    const createdAt = new Date(`${dateKey(dateOffset(today, -ago))}T12:00:00`).toISOString();
    return { id, title, map, type, side, author, createdAt, updatedAt: createdAt, demoVideo, favorite, steps, completed: [], video: "", script: "", description: type === "script" ? "План командного взаимодействия. Роли, тайминги и позиции уточняйте на тренировке." : "" };
  });
  return { version: 1, materials, filters: defaultFilters(), selected: materials[0].id };
}

export function validVideo(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port || value.length > 2000) return false;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) return url.pathname === "/watch" && /^[\w-]{11}$/.test(url.searchParams.get("v") ?? "") || /^\/(?:shorts|live)\/[\w-]{11}\/?$/.test(url.pathname);
    if (url.hostname === "youtu.be") return /^\/[\w-]{11}\/?$/.test(url.pathname);
    if (["rutube.ru", "www.rutube.ru"].includes(url.hostname)) return /^\/video\/[a-zA-Z0-9]+\/?$/.test(url.pathname);
    // Direct video files may live on a public CDN. No local/private hosts or IP literals.
    return /\.(?:mp4|webm|ogv)$/i.test(url.pathname) && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname) && !/\.(?:local|localhost|internal|lan|home|test|invalid)$/i.test(url.hostname);
  } catch { return false; }
}
export function isDirectVideo(value: string) { try { return /\.(?:mp4|webm|ogv)$/i.test(new URL(value).pathname); } catch { return false; } }
function validMaterial(value: unknown): value is Material {
  if (!value || typeof value !== "object") return false;
  const m = value as Material;
  return typeof m.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(m.id) && typeof m.title === "string" && !!m.title.trim() && m.title.length <= 120 && maps.includes(m.map) && Object.hasOwn(materialTypes, m.type) && ["T", "CT"].includes(m.side) && typeof m.description === "string" && m.description.length <= 2000 && Array.isArray(m.steps) && m.steps.length >= 1 && m.steps.length <= 20 && m.steps.every(s => typeof s === "string" && !!s.trim() && s.length <= 300) && typeof m.script === "string" && m.script.length <= 10000 && typeof m.video === "string" && validVideo(m.video) && typeof m.author === "string" && !!m.author.trim() && m.author.length <= 60 && typeof m.createdAt === "string" && Number.isFinite(Date.parse(m.createdAt)) && typeof m.updatedAt === "string" && Number.isFinite(Date.parse(m.updatedAt));
}
export function readStrategiesStore(today = new Date(), raw?: string | null): StrategiesStore {
  const fallback = createStrategiesStore(today);
  try {
    const value = JSON.parse(raw === undefined ? localStorage.getItem(STRATEGIES_STORAGE_KEY) ?? "null" : raw ?? "null");
    if (!value || value.version !== 1 || !Array.isArray(value.materials)) return fallback;
    const materials: Material[] = value.materials.filter(validMaterial).slice(0, 500).filter((m: Material, i: number, all: Material[]) => all.findIndex(other => other.id === m.id) === i).map((m: Material) => ({ ...m, favorite: m.favorite === true, demoVideo: m.demoVideo === true, completed: Array.isArray(m.completed) ? [...new Set(m.completed.filter(n => Number.isInteger(n) && n >= 0 && n < m.steps.length))] : [] }));
    const f = value.filters;
    const filters: MaterialFilters = { search: typeof f?.search === "string" ? f.search.slice(0, 200) : "", map: maps.includes(f?.map) ? f.map : "all", type: Object.hasOwn(materialTypes, f?.type) ? f.type : "all", side: ["T", "CT"].includes(f?.side) ? f.side : "all", favorites: f?.favorites === true };
    return { version: 1, materials, filters, selected: materials.some(m => m.id === value.selected) ? value.selected : materials[0]?.id ?? null };
  } catch { return fallback; }
}
export function filterMaterials(materials: Material[], filters: MaterialFilters) {
  const query = filters.search.trim().toLocaleLowerCase("ru");
  return materials.filter(m => (filters.map === "all" || m.map === filters.map) && (filters.type === "all" || m.type === filters.type) && (filters.side === "all" || m.side === filters.side) && (!filters.favorites || m.favorite) && (!query || `${m.title} ${m.map} ${m.description} ${materialTypes[m.type]} ${m.author}`.toLocaleLowerCase("ru").includes(query))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function validateDraft(draft: MaterialDraft): string {
  if (!draft.title.trim() || draft.title.trim().length > 120) return "Введите название до 120 символов.";
  if (!maps.includes(draft.map) || !Object.hasOwn(materialTypes, draft.type) || !["T", "CT"].includes(draft.side)) return "Выберите карту, тип и сторону.";
  if (draft.description.length > 2000) return "Описание не должно превышать 2 000 символов.";
  const steps = draft.steps.split("\n").map(s => s.trim()).filter(Boolean);
  if (!steps.length || steps.length > 20 || steps.some(s => s.length > 300)) return "Добавьте от 1 до 20 шагов, каждый до 300 символов. Один шаг — одна строка.";
  if (draft.script.length > 10000) return "Текст скрипта не должен превышать 10 000 символов.";
  if (!validVideo(draft.video)) return "Укажите HTTPS-ссылку на YouTube, Rutube или прямой видеофайл MP4 / WebM / OGV.";
  return "";
}
export function materialFromDraft(draft: MaterialDraft, id: string, now: Date, existing?: Material): Material {
  const steps = draft.steps.split("\n").map(s => s.trim()).filter(Boolean);
  return { id, title: draft.title.trim(), map: draft.map, type: draft.type, side: draft.side, description: draft.description.trim(), steps, script: draft.type === "script" ? draft.script.trim() : "", video: draft.video.trim(), author: existing?.author ?? "Coach", createdAt: existing?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(), favorite: existing?.favorite ?? false, demoVideo: existing?.demoVideo ?? false, completed: existing && JSON.stringify(steps) === JSON.stringify(existing.steps) ? existing.completed : [] };
}
export function toDraft(material: Material): MaterialDraft { return { title: material.title, map: material.map, type: material.type, side: material.side, description: material.description, steps: material.steps.join("\n"), script: material.script, video: material.video }; }
export function materialDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(parseDate(dateKey(new Date(value)))); }
export const materialCount = (count: number) => `${count} ${{ one: "запись", few: "записи", many: "записей", other: "записи", zero: "записей", two: "записи" }[new Intl.PluralRules("ru-RU").select(count)]}`;
