import { BillingState, initialBilling, readBilling } from "../plans/plans-data";

export const PROFILE_STORAGE_KEY = "performance-profile:v1";
export const PROFILE_EVENT = "performance-profile-updated";
export type ProfileKind = "solo" | "team" | "staff";
export type Plan = "free" | "pro" | "team";
export type ProfileStore = {
  version: 1;
  name: string;
  nickname: string;
  email: string;
  faceit: string;
  photo: string | null;
  memberships: ProfileKind[];
  active: ProfileKind;
  subscription: { plan: Plan; started: string; expires: string; autoRenew: boolean };
  billing?: BillingState;
};
export const profileLabels: Record<ProfileKind, string> = { solo: "Игрок · Solo", team: "Игрок · Команда", staff: "Менеджер · Staff" };
export const planLabels: Record<Plan, string> = { free: "Бесплатный", pro: "Pro", team: "Team" };
export function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function addDays(key: string, amount: number) { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate() + amount); return dayKey(date); }
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime()) && dayKey(new Date(`${value}T12:00:00`)) === value;
export function initialProfile(now = new Date()): ProfileStore {
  const today = dayKey(now);
  return { version: 1, name: "Анастасия", nickname: "NICKNAME12345", email: "nickname@example.com", faceit: "https://www.faceit.com/ru/players/NICKNAME12345", photo: null, memberships: ["solo"], active: "solo", subscription: { plan: "pro", started: today, expires: addDays(today, 31), autoRenew: true }, billing: initialBilling(now) };
}
export function initials(nickname: string) { return nickname.trim().slice(0, 2).toLocaleUpperCase("ru-RU") || "NI"; }
export function validPhoto(value: unknown): value is string { return typeof value === "string" && value.length <= 400000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value); }
export function readProfile(now = new Date(), raw?: string | null): ProfileStore {
  const fallback = initialProfile(now);
  try {
    const value = JSON.parse(raw === undefined ? localStorage.getItem(PROFILE_STORAGE_KEY) ?? "null" : raw ?? "null");
    if (!value || value.version !== 1) return fallback;
    const memberships: ProfileKind[] = ["solo", ...(["team", "staff"] as const).filter(kind => Array.isArray(value.memberships) && value.memberships.includes(kind))];
    const name = typeof value.name === "string" ? value.name.trim().slice(0, 80) : "";
    const nickname = typeof value.nickname === "string" ? value.nickname.trim() : "";
    const faceit = typeof value.faceit === "string" ? value.faceit.trim().slice(0, 500) : "";
    const candidate = { name, nickname, faceit };
    const subscription = value.subscription;
    const legacy: ProfileStore["subscription"] = subscription && ["free", "pro", "team"].includes(subscription.plan) && validDate(subscription.started) && validDate(subscription.expires) && subscription.started <= subscription.expires ? { plan: subscription.plan, started: subscription.started, expires: subscription.expires, autoRenew: subscription.autoRenew === true } : fallback.subscription;
    return { ...fallback, ...(Object.keys(validateDetails(candidate)).length ? {} : candidate), photo: validPhoto(value.photo) ? value.photo : null, memberships, active: memberships.includes(value.active) ? value.active : "solo", subscription: legacy, billing: readBilling(value.billing, legacy) };
  } catch { return fallback; }
}
export function writeProfile(profile: ProfileStore) { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); window.dispatchEvent(new Event(PROFILE_EVENT)); }
export function validateDetails(value: Pick<ProfileStore, "name" | "nickname" | "faceit">) {
  const errors: Record<string, string> = {};
  if (!value.name.trim() || value.name.trim().length > 80) errors.name = "Введите имя — до 80 символов";
  if (!/^[\p{L}\p{N}_-]{3,32}$/u.test(value.nickname.trim())) errors.nickname = "От 3 до 32 букв, цифр, дефисов или подчёркиваний";
  if (value.faceit.trim()) {
    try { const url = new URL(value.faceit.trim()); if (url.protocol !== "https:" || !["faceit.com", "www.faceit.com"].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port || !/^\/(?:[a-z]{2}\/)?players\/[^/]+\/?$/.test(url.pathname) || url.search || url.hash) errors.faceit = "Укажите HTTPS-ссылку на профиль игрока на faceit.com"; }
    catch { errors.faceit = "Укажите ссылку на профиль FACEIT или оставьте поле пустым"; }
  }
  return errors;
}
export function validatePasswords(current: string, next: string, repeat: string) {
  if (!current) return "Введите текущий пароль";
  if (current.length > 128 || next.length > 128) return "Пароль должен быть не длиннее 128 символов";
  if (next.length < 8 || !/\p{L}/u.test(next) || !/\p{N}/u.test(next)) return "Новый пароль: минимум 8 символов, буквы и цифры";
  if (next === current) return "Новый пароль должен отличаться от текущего";
  if (next !== repeat) return "Пароли не совпадают";
  return "";
}
export function demoMembership(kind: "team" | "staff", code: string): ProfileKind | null { return code.trim().toUpperCase() === (kind === "team" ? "AT-7F3K" : "STAFF-7F3K") ? kind : null; }
export function subscriptionState(profile: ProfileStore, now = new Date()) {
  const { started, expires, plan } = profile.subscription;
  const utc = (key: string) => Date.parse(`${key}T00:00:00Z`);
  const today = dayKey(now);
  const days = Math.max(0, Math.ceil((utc(expires) - utc(today)) / 86400000));
  const duration = Math.max(1, (utc(expires) - utc(started)) / 86400000);
  return { days, expired: expires < today, remaining: Math.min(100, Math.max(0, days / duration * 100)), paid: plan !== "free" };
}
