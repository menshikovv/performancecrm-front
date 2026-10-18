import type { ProfileStore } from "../profile/profile-data";

export type Product = "crm" | "game" | "correlation";
export type Term = 1 | 3 | 6;
export type AccessPeriod = { started: string; expires: string };
export type DemoReceipt = { id: string; product: Product; months: Term; amount: number; days: number; expires: string; createdAt: string; status: "demo" };
export type BillingState = { version: 1; term: Term; crm: AccessPeriod | null; game: AccessPeriod | null; correlation: AccessPeriod | null; receipts: DemoReceipt[] };
export const productLabels: Record<Product, string> = { crm: "PerformanceCoach CRM", game: "Игровая статистика", correlation: "Корреляционный анализ" };
export const terms: Term[] = [1, 3, 6];
export const CRM_MONTHLY_PRICE = 23990;
export const discounts: Record<Term, number> = { 1: 0, 3: 10, 6: 20 };
export function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function plusDays(key: string, amount: number) { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate() + amount); return dateKey(date); }
export function validDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime()) && dateKey(new Date(`${value}T12:00:00`)) === value; }
export const rubles = (value: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
export const longDate = (key: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${key}T12:00:00`)).replace(/ г\.$/, "");
export const briefDate = (key: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(`${key}T12:00:00`));
export const daysLabel = (count: number) => `${count} ${{ one: "день", few: "дня", many: "дней", other: "дней", two: "дня", zero: "дней" }[new Intl.PluralRules("ru-RU").select(count)]}`;
export const termLabel = (term: Term) => term === 1 ? "1 месяц" : term === 3 ? "3 месяца" : "6 месяцев";
export function quote(product: Product, months: Term = 1) {
  const term = product === "crm" ? months : 1;
  const base = product === "crm" ? CRM_MONTHLY_PRICE : product === "game" ? 399 : 499;
  const discount = product === "crm" ? discounts[term] : 0;
  const full = base * term; const total = Math.round(full * (100 - discount) / 100);
  return { product, months: term, days: term * 30, full, total, discount, perMonth: total / term, saving: full - total };
}
export function emptyBilling(): BillingState { return { version: 1, term: 3, crm: null, game: null, correlation: null, receipts: [] }; }
export function initialBilling(now = new Date()): BillingState { const today = dateKey(now); return { ...emptyBilling(), game: { started: plusDays(today, -26), expires: plusDays(today, 4) } }; }
function readPeriod(value: unknown): AccessPeriod | null {
  if (!value || typeof value !== "object") return null;
  const period = value as Record<string, unknown>;
  return validDate(period.started) && validDate(period.expires) && period.started <= period.expires ? { started: period.started, expires: period.expires } : null;
}
export function legacyBilling(subscription: ProfileStore["subscription"]): BillingState { return { ...emptyBilling(), crm: subscription.plan === "free" ? null : { started: subscription.started, expires: subscription.expires } }; }
export function readBilling(value: unknown, subscription: ProfileStore["subscription"]): BillingState {
  if (!value || typeof value !== "object" || (value as Record<string, unknown>).version !== 1) return legacyBilling(subscription);
  const raw = value as Record<string, unknown>;
  const receipts = (Array.isArray(raw.receipts) ? raw.receipts : []).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) || !["crm", "game", "correlation"].includes(r.product as string) || !terms.includes(r.months as Term) || !validDate(r.expires) || typeof r.createdAt !== "string" || !Number.isFinite(Date.parse(r.createdAt)) || r.status !== "demo") return [];
    const expected = quote(r.product as Product, r.months as Term);
    if (r.amount !== expected.total || r.days !== expected.days || r.months !== expected.months) return [];
    return [{ id: r.id, product: r.product as Product, months: r.months as Term, amount: expected.total, days: expected.days, expires: r.expires, createdAt: r.createdAt, status: "demo" as const }];
  }).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).slice(0, 20);
  return { version: 1, term: terms.includes(raw.term as Term) ? raw.term as Term : 3, crm: readPeriod(raw.crm), game: readPeriod(raw.game), correlation: readPeriod(raw.correlation), receipts };
}
export function billingFor(profile: ProfileStore): BillingState { return profile.billing ?? legacyBilling(profile.subscription); }
export function active(period: AccessPeriod | null, now = new Date()) { return !!period && period.started <= dateKey(now) && period.expires >= dateKey(now); }
export function periodState(period: AccessPeriod, now = new Date()) {
  const utc = (key: string) => Date.parse(`${key}T00:00:00Z`);
  const days = Math.max(0, Math.ceil((utc(period.expires) - utc(dateKey(now))) / 86400000));
  const total = Math.max(1, (utc(period.expires) - utc(period.started)) / 86400000);
  return { days, remaining: Math.min(100, days / total * 100), expired: period.expires < dateKey(now), soon: active(period, now) && days <= 7 };
}
export function effectiveAccess(billing: BillingState, product: Product, now = new Date()): { period: AccessPeriod; included: boolean } | null {
  const own = billing[product]; const full = product !== "crm" ? billing.crm : null;
  if (active(full, now) && (!active(own, now) || full!.expires >= own!.expires)) return { period: full!, included: true };
  if (active(own, now)) return { period: own!, included: false };
  return null;
}
export function accessSummary(billing: BillingState, now = new Date()) {
  const crm = active(billing.crm, now); const game = active(billing.game, now); const correlation = active(billing.correlation, now);
  const entries = crm ? [{ product: "crm" as const, period: billing.crm! }] : [{ product: "game" as const, period: billing.game }, { product: "correlation" as const, period: billing.correlation }].filter(item => active(item.period, now)) as { product: Product; period: AccessPeriod }[];
  entries.sort((a, b) => a.period.expires.localeCompare(b.period.expires));
  const expires = entries[0]?.period.expires ?? null;
  return { crm, game: crm || game, correlation: crm || correlation, entries, expires, label: crm ? productLabels.crm : game && correlation ? "Игровая статистика + анализ" : game ? productLabels.game : correlation ? productLabels.correlation : "Бесплатный доступ" };
}
export function purchasePreview(billing: BillingState, product: Product, term: Term, now = new Date()) {
  const price = quote(product, term); const today = dateKey(now); const current = billing[product];
  const base = current && current.expires >= today ? current.expires : today;
  return { ...price, expires: plusDays(base, price.days), covered: product !== "crm" && active(billing.crm, now), renew: !!current && active(current, now) };
}
export function completeDemoPurchase(profile: ProfileStore, product: Product, term: Term, receiptId: string, now = new Date()): ProfileStore {
  const billing = billingFor(profile);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(receiptId)) throw new Error("Некорректный номер демозаказа");
  if (billing.receipts.some(receipt => receipt.id === receiptId)) return profile;
  const offer = purchasePreview(billing, product, term, now);
  if (offer.covered) throw new Error("Модуль уже входит в активный тариф CRM");
  const today = dateKey(now); const previous = billing[product];
  const period = { started: previous && active(previous, now) ? previous.started : today, expires: offer.expires };
  const receipt: DemoReceipt = { id: receiptId, product, months: offer.months, amount: offer.total, days: offer.days, expires: offer.expires, createdAt: now.toISOString(), status: "demo" };
  return { ...profile, billing: { ...billing, term: product === "crm" ? term : billing.term, [product]: period, receipts: [receipt, ...billing.receipts].slice(0, 20) } };
}

export type ComparisonGroup = { name: string; rows: { label: string; values: [boolean | string, boolean | string, boolean | string, boolean | string] }[] };
export const comparison: ComparisonGroup[] = [
  { name: "Форма и тесты", rows: [
    { label: "Обзор, быстрый старт, ранние сигналы", values: [true, true, true, true] },
    { label: "Батарея из 5 когнитивных тестов", values: [true, true, true, true] },
    { label: "История и тренд тестов за 7 дней", values: [false, false, false, true] },
    { label: "Отметки настроения и энергии", values: [true, true, true, true] },
    { label: "Еженедельные тесты и колесо баланса", values: [false, false, false, true] },
  ] },
  { name: "Восстановление", rows: [{ label: "Сон, экранное время, питание с телефона", values: ["Сводка", "Сводка", "Сводка", true] }] },
  { name: "Игра", rows: [
    { label: "Ввод игр с праков", values: [true, true, true, true] },
    { label: "Витрина матчевых метрик, фильтры, история", values: [false, true, false, true] },
  ] },
  { name: "Аналитика", rows: [
    { label: "Корреляционный анализ и графики связей", values: [false, false, true, true] },
    { label: "AI-вывод и сравнение метрик", values: [false, false, true, true] },
  ] },
  { name: "Срок", rows: [{ label: "Доступ", values: ["Без срока", "30 дней", "30 дней", "30 / 90 / 180 дней"] }] },
];
export const faqs = [
  { question: "С какого дня считается срок?", answer: "Со дня оплаты. Если тариф уже активен, новые дни прибавляются к текущей дате окончания — ничего не сгорает. Один месяц тарифа — 30 дней, три — 90, шесть — 180. В этой демоверсии оплата только моделируется." },
  { question: "Что будет, когда доступ закончится?", answer: "Останутся бесплатные возможности: обзор, когнитивные тесты, отметки состояния и ввод игр. История не удаляется. В текущей демоверсии платные разделы не блокируются — здесь можно проверить выбор и продление доступа." },
  { question: "Нужно ли покупать модули, если есть CRM?", answer: "Нет. Игровая статистика и корреляционный анализ уже входят в полный тариф CRM. Отдельные модули нужны, если вам не требуется вся CRM. Ранее купленные сроки модулей при покупке CRM сохраняются, но не складываются со сроком CRM и не возвращаются деньгами." },
  { question: "Я играю в команде. Кто оплачивает доступ?", answer: "Доступ может оформить сам игрок или владелец команды — условия командного подключения нужно согласовать с ним. Код команды подключает профиль, но сам по себе не подтверждает оплату. В демоверсии это разные независимые действия." },
];
