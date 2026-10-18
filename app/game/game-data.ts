import { dateKey, dateOffset, parseDate } from "../overview/overview-data";

export const GAME_STORAGE_KEY = "performance-game:v1";
export const mapNames = ["Mirage", "Inferno", "Nuke", "Ancient", "Anubis", "Dust2", "Train", "Overpass"] as const;
export type MapName = typeof mapNames[number];
export type GameType = "practice" | "faceit" | "tournament";
export type Lineup = "team" | "solo";
export const typeLabels: Record<GameType, string> = { practice: "Пракк", faceit: "Faceit", tournament: "Турнир" };
export const fields = [
  { key: "kills", label: "K", title: "Убийства", required: true, max: 9999, integer: true },
  { key: "deaths", label: "D", title: "Смерти", required: true, max: 9999, integer: true },
  { key: "assists", label: "A", title: "Помощь в убийствах", required: true, max: 9999, integer: true },
  { key: "adr", label: "ADR", title: "Средний урон за раунд", required: true, max: 9999, integer: false },
  { key: "kast", label: "KAST %", title: "KAST, %", required: false, max: 100, integer: false },
  { key: "fk", label: "FK", title: "Первые убийства", required: false, max: 9999, integer: true },
  { key: "fd", label: "FD", title: "Первые смерти", required: false, max: 9999, integer: true },
  { key: "multi", label: "Мульти", title: "Средние мультикиллы", required: false, max: 5, integer: false },
  { key: "flash", label: "Ослепл.", title: "Среднее время ослепления, с", required: false, max: 9999, integer: false },
  { key: "hs", label: "HS %", title: "Попадания в голову, %", required: false, max: 100, integer: false },
  { key: "utility", label: "UD", title: "Урон гранатами", required: false, max: 9999, integer: false },
  { key: "rating", label: "Rating", title: "Рейтинг матча из вашего источника", required: false, max: 10, integer: false },
] as const;
export type FieldKey = typeof fields[number]["key"];
export type PlayerDraft = Record<FieldKey, string>;
export type PlayerStats = Record<FieldKey, number | null>;
export interface MapDraft { id: string; name: MapName; us: string; them: string; pistols: [boolean | null, boolean | null]; players: PlayerDraft[] }
export interface GameDraft { editingId: string | null; type: GameType; date: string; opponent: string; lineup: Lineup; names: string[]; maps: MapDraft[]; activeMap: string }
export interface GameMap { id: string; name: MapName; us: number; them: number; pistols: [boolean | null, boolean | null]; players: PlayerStats[] }
export interface GameRecord { id: string; type: GameType; date: string; opponent: string; lineup: Lineup; names: string[]; maps: GameMap[]; createdAt: string; updatedAt: string; origin: "demo" | "manual" }
export interface GameStore { version: 1; games: GameRecord[]; draft: GameDraft | null; view: "entry" | "history" }
export interface DraftIssue { message: string; mapId?: string; row?: number; field?: FieldKey; target?: "date" | "score" | "name" }
export const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDate(value)) === value;
export const blankPlayer = (): PlayerDraft => Object.fromEntries(fields.map(field => [field.key, ""])) as PlayerDraft;
export function blankMap(name: MapName = "Mirage"): MapDraft { return { id: crypto.randomUUID(), name, us: "", them: "", pistols: [null, null], players: Array.from({ length: 5 }, blankPlayer) }; }
export function newDraft(today = new Date(), example = false): GameDraft {
  const map = blankMap();
  if (example) {
    map.us = "13"; map.them = "9"; map.pistols = [true, null];
    map.players[0] = { kills: "24", deaths: "15", assists: "5", adr: "91", kast: "78", fk: "5", fd: "2", multi: "1.2", flash: "2.1", hs: "51", utility: "24", rating: "1.31" };
    map.players[1] = { ...blankPlayer(), kills: "18", deaths: "17", assists: "7", adr: "76", kast: "72", fk: "3", fd: "4", hs: "46" };
  }
  return { editingId: null, type: "practice", date: dateKey(today), opponent: "", lineup: "team", names: ["NICKNAME12345", "Игрок 2", "Игрок 3", "Игрок 4", "Игрок 5"], maps: [map], activeMap: map.id };
}
export function parseCell(raw: string, field: typeof fields[number]): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized || !/^\d+(?:\.\d{1,3})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 && value <= field.max && (!field.integer || Number.isInteger(value)) ? value : null;
}
const score = (value: string) => /^\d{1,2}$/.test(value.trim()) ? Number(value) : null;
export function visibleCount(lineup: Lineup) { return lineup === "team" ? 5 : 1; }
export function validateDraft(draft: GameDraft, today = dateKey(new Date())): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!validDate(draft.date) || draft.date > today) issues.push({ message: "Выберите сегодняшнюю или прошедшую дату игры", target: "date" });
  draft.names.slice(0, visibleCount(draft.lineup)).forEach((name, row) => { if (!name.trim()) issues.push({ message: `Укажите имя игрока ${row + 1}`, target: "name", row, mapId: draft.activeMap }); });
  draft.maps.forEach((map, index) => {
    const us = score(map.us), them = score(map.them);
    if (us === null || them === null || us + them === 0) issues.push({ message: `Карта ${index + 1}: укажите счёт от 0 до 99, хотя бы один раунд должен быть сыгран`, mapId: map.id, target: "score" });
    map.players.slice(0, visibleCount(draft.lineup)).forEach((player, row) => fields.forEach(field => {
      const raw = player[field.key];
      if (field.required && !raw.trim()) issues.push({ message: `Карта ${index + 1}, ${draft.names[row] || `игрок ${row + 1}`}: заполните ${field.label}`, mapId: map.id, row, field: field.key });
      else if (raw.trim() && parseCell(raw, field) === null) issues.push({ message: `Карта ${index + 1}, ${draft.names[row] || `игрок ${row + 1}`}: ${field.label} — ${field.integer ? "целое число" : "число"} от 0 до ${field.max}`, mapId: map.id, row, field: field.key });
    }));
  });
  return issues;
}
export function draftCounts(draft: GameDraft) {
  let required = 0, optional = 0;
  draft.maps.forEach(map => map.players.slice(0, visibleCount(draft.lineup)).forEach(player => fields.forEach(field => { if (!player[field.key].trim()) { if (field.required) required++; else optional++; } })));
  return { required, optional, missingPistols: draft.maps.filter(map => map.pistols.some(value => value === null)).length };
}
export function saveDraft(draft: GameDraft, games: GameRecord[], now = new Date()): GameRecord {
  const issues = validateDraft(draft, dateKey(now));
  if (issues.length) throw new Error(issues[0].message);
  const existing = games.find(game => game.id === draft.editingId);
  return { id: existing?.id ?? crypto.randomUUID(), type: draft.type, date: draft.date, opponent: draft.opponent.trim(), lineup: draft.lineup, names: draft.names.map(name => name.trim()), maps: draft.maps.map(map => ({ ...map, us: score(map.us)!, them: score(map.them)!, players: map.players.map(player => Object.fromEntries(fields.map(field => [field.key, parseCell(player[field.key], field)])) as PlayerStats) })), createdAt: existing?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(), origin: "manual" };
}
export function editGame(game: GameRecord): GameDraft { return { editingId: game.id, type: game.type, date: game.date, opponent: game.opponent, lineup: game.lineup, names: [...game.names], activeMap: game.maps[0].id, maps: game.maps.map(map => ({ ...map, us: String(map.us), them: String(map.them), pistols: [...map.pistols], players: map.players.map(player => Object.fromEntries(fields.map(field => [field.key, player[field.key] === null ? "" : String(player[field.key])])) as PlayerDraft) })) }; }
export function toMaps(draft: GameDraft): GameMap[] { return draft.maps.flatMap(map => { const us = score(map.us), them = score(map.them); return us === null || them === null || us + them === 0 ? [] : [{ ...map, us, them, players: map.players.map(player => Object.fromEntries(fields.map(field => [field.key, parseCell(player[field.key], field)])) as PlayerStats) }]; }); }
export function summarizeMaps(maps: GameMap[], lineup: Lineup) {
  const wins = maps.filter(map => map.us > map.them).length, losses = maps.filter(map => map.us < map.them).length, draws = maps.length - wins - losses;
  const won = maps.reduce((sum, map) => sum + map.us, 0), lost = maps.reduce((sum, map) => sum + map.them, 0);
  const pistols = maps.flatMap(map => map.pistols).filter((value): value is boolean => value !== null);
  const pairs = maps.flatMap(map => map.players.slice(0, visibleCount(lineup))).filter(player => player.kills !== null && player.deaths !== null);
  const kills = pairs.reduce((sum, player) => sum + player.kills!, 0), deaths = pairs.reduce((sum, player) => sum + player.deaths!, 0);
  return { wins, losses, draws, mapCount: maps.length, won, lost, winRate: maps.length ? wins / maps.length * 100 : null, roundRate: won + lost ? won / (won + lost) * 100 : null, pistolRate: pistols.length ? pistols.filter(Boolean).length / pistols.length * 100 : null, knownPistols: pistols.length, averageWon: maps.length ? won / maps.length : null, averageLost: maps.length ? lost / maps.length : null, kd: pairs.length && deaths > 0 ? kills / deaths : null, kills, deaths, playerPairs: pairs.length };
}
export function personalMetrics(games: GameRecord[]) {
  const maps = games.flatMap(game => game.maps), rows = maps.map(map => ({ stats: map.players[0], rounds: map.us + map.them }));
  const totalKills = rows.reduce((sum, row) => sum + (row.stats.kills ?? 0), 0), totalDeaths = rows.reduce((sum, row) => sum + (row.stats.deaths ?? 0), 0);
  const weighted = (key: "adr" | "rating") => { const valid = rows.filter(row => row.stats[key] !== null); const rounds = valid.reduce((sum, row) => sum + row.rounds, 0); return rounds ? valid.reduce((sum, row) => sum + row.stats[key]! * row.rounds, 0) / rounds : null; };
  return { kd: totalDeaths > 0 ? totalKills / totalDeaths : null, rating: weighted("rating"), adr: weighted("adr"), winrate: maps.length ? maps.filter(map => map.us > map.them).length / maps.length * 100 : null, kills: totalKills, deaths: totalDeaths, maps: maps.length };
}
export function dailyGameMetrics(games: GameRecord[]) { const dates = [...new Set(games.map(game => game.date))]; return dates.map(date => ({ date, ...personalMetrics(games.filter(game => game.date === date)) })); }

export function parseTsv(text: string): string[][] {
  if (text.length > 50000) throw new Error("Вставьте не больше 50 000 символов за один раз");
  const rows: string[][] = [[]]; let value = "", quoted = false;
  const input = text.replace(/\r\n?/g, "\n");
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') { if (quoted && input[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && (char === "\t" || char === "\n")) { rows.at(-1)!.push(value); value = ""; if (char === "\n") rows.push([]); }
    else value += char;
  }
  rows.at(-1)!.push(value);
  while (rows.length && rows.at(-1)!.every(cell => !cell.trim())) rows.pop();
  return rows;
}
export function pasteInto(draft: GameDraft, mapId: string, rowIndex: number, column: number, text: string) {
  const grid = parseTsv(text), count = visibleCount(draft.lineup);
  const next = { ...draft, names: [...draft.names], maps: draft.maps.map(map => map.id === mapId ? { ...map, players: map.players.map(player => ({ ...player })) } : map) };
  const map = next.maps.find(item => item.id === mapId)!; let cells = 0, clipped = false;
  grid.forEach((row, i) => row.forEach((cell, j) => {
    const r = rowIndex + i, c = column + j;
    if (r >= count || c >= fields.length) { if (cell.trim()) clipped = true; return; }
    if (c < 0) next.names[r] = cell.trim().slice(0, 32);
    else map.players[r][fields[c].key] = cell.trim().replace(",", ".").slice(0, 12);
    cells++;
  }));
  return { draft: next, cells, clipped };
}

export function createGameStore(today = new Date()): GameStore {
  const games: GameRecord[] = [];
  for (let index = 0; index < 12; index++) {
    const draft = newDraft(dateOffset(today, -index * 2 - 1)); draft.opponent = ["Aurora", "Team Spirit", "Falcons", "NAVI"][index % 4]; draft.type = index % 3 === 0 ? "faceit" : "practice";
    draft.maps[0].name = mapNames[index % mapNames.length]; draft.maps[0].us = index % 3 === 1 ? "9" : "13"; draft.maps[0].them = index % 3 === 1 ? "13" : String(6 + index % 6); draft.maps[0].pistols = [index % 2 === 0, index % 3 !== 0];
    draft.maps[0].players = Array.from({ length: 5 }, (_, row) => ({ kills: String(15 + (index + row * 2) % 12), deaths: String(12 + (index + row) % 8), assists: String(3 + row % 4), adr: String(70 + (index + row * 7) % 32), kast: String(65 + (index + row) % 20), fk: String(2 + row % 4), fd: String(row % 4), multi: "1.2", flash: "2.5", hs: String(38 + row * 5), utility: String(15 + row * 4), rating: (1 + (index % 5) * .08).toFixed(2) }));
    const game = saveDraft(draft, [], today); game.id = `demo-game-${index}`; game.origin = "demo"; games.push(game);
  }
  return { version: 1, games, draft: newDraft(today, true), view: "entry" };
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function validBase(value: unknown): value is Record<string, unknown> & { maps: unknown[] } {
  return object(value) && Object.hasOwn(typeLabels, String(value.type)) && validDate(value.date) && typeof value.opponent === "string" && value.opponent.length <= 80 && ["team", "solo"].includes(String(value.lineup)) && Array.isArray(value.names) && value.names.length === 5 && value.names.every(name => typeof name === "string" && name.length <= 32) && Array.isArray(value.maps) && value.maps.length >= 1 && value.maps.length <= 7;
}
function validMap(value: unknown, draft: boolean) {
  if (!object(value) || typeof value.id !== "string" || !mapNames.includes(value.name as MapName) || !Array.isArray(value.pistols) || value.pistols.length !== 2 || !value.pistols.every(item => item === null || typeof item === "boolean") || !Array.isArray(value.players) || value.players.length !== 5) return false;
  const validScore = (score: unknown) => draft ? typeof score === "string" && score.length <= 3 : typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 99;
  return validScore(value.us) && validScore(value.them) && value.players.every(player => object(player) && fields.every(field => draft ? typeof player[field.key] === "string" && (player[field.key] as string).length <= 12 : player[field.key] === null || typeof player[field.key] === "number" && Number.isFinite(player[field.key]) && (player[field.key] as number) >= 0 && (player[field.key] as number) <= field.max && (!field.integer || Number.isInteger(player[field.key]))));
}
export function readGameStore(today = new Date()): GameStore {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(GAME_STORAGE_KEY) || "null");
    if (!object(raw) || raw.version !== 1 || !Array.isArray(raw.games)) return createGameStore(today);
    const games = raw.games.filter((item): item is GameRecord => validBase(item) && typeof item.id === "string" && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) && typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt)) && ["demo", "manual"].includes(String(item.origin)) && (item.maps as unknown[]).every(map => validMap(map, false)));
    const draft = validBase(raw.draft) && (raw.draft.editingId === null || typeof raw.draft.editingId === "string") && typeof raw.draft.activeMap === "string" && (raw.draft.maps as unknown[]).every(map => validMap(map, true)) ? raw.draft as unknown as GameDraft : null;
    if (draft && !draft.maps.some(map => map.id === draft.activeMap)) draft.activeMap = draft.maps[0].id;
    return { version: 1, games: [...new Map(games.map(game => [game.id, game])).values()], draft, view: raw.view === "history" ? "history" : "entry" };
  } catch { return createGameStore(today); }
}
