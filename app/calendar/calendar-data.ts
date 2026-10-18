export type UserRole = "player" | "manager";
export type CalendarScope = "personal" | "team" | "player";
export type EventType = "theory" | "practice" | "camp" | "personal" | "psychologist" | "esea" | "training" | "match" | "recovery" | "meeting" | "other";

export interface CalendarOwner {
  id: string;
  name: string;
  initials: string;
  color: string;
  scope: CalendarScope;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  type: EventType;
  ownerId: string;
  scope: CalendarScope;
  links: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarNotification {
  id: string;
  title: string;
  message: string;
  eventId?: string;
  date?: string;
  createdAt: string;
  read: boolean;
}

export interface CalendarStore {
  version: 1;
  events: CalendarEvent[];
  notifications: CalendarNotification[];
  role: UserRole;
}

export const STORAGE_KEY = "calendar-app:v1";

export const owners: CalendarOwner[] = [
  { id: "personal", name: "Личный", initials: "Я", color: "#7c5cff", scope: "personal" },
  { id: "team", name: "Командный", initials: "К", color: "#2777f7", scope: "team" },
  { id: "staff-personal", name: "Личный Staff", initials: "CO", color: "#a579ff", scope: "personal" },
  { id: "player-vexa", name: "vexa", initials: "VE", color: "#39cdf6", scope: "player" },
  { id: "player-frost", name: "frost", initials: "FR", color: "#4387ff", scope: "player" },
  { id: "player-kairo", name: "Kairo", initials: "KA", color: "#ffca3c", scope: "player" },
  { id: "player-mirage", name: "m1rage", initials: "M1", color: "#50d4aa", scope: "player" },
  { id: "player-zenn", name: "zeNN", initials: "ZE", color: "#af7aff", scope: "player" },
  // Keep previous calendar identities for existing saved events; never rename their owners.
  { id: "player-nikita", name: "Никита Орлов", initials: "НО", color: "#ef6363", scope: "player" },
  { id: "player-alex", name: "Алексей Ветров", initials: "АВ", color: "#10a77a", scope: "player" },
  { id: "player-ilya", name: "Илья Романов", initials: "ИР", color: "#e68a2e", scope: "player" },
  { id: "player-max", name: "Максим Волков", initials: "МВ", color: "#2d9cbc", scope: "player" },
];

export const staffOwners = ["staff-personal", "team", "player-vexa", "player-frost", "player-kairo", "player-mirage", "player-zenn"].map(id => owners.find(owner => owner.id === id)!);
export const ownerTag = (id: string) => id === "staff-personal" || id === "personal" ? "#личный" : id === "team" ? "#командный" : `#${owners.find(owner => owner.id === id)?.name ?? "календарь"}`;
export const STAFF_CALENDAR_VIEW_KEY = "calendar-staff-view:v1";
export type StaffCalendarView = { version: 1; ownerId: string; date: string; month: string };
export function readStaffCalendarView(today = new Date(), raw?: string | null): StaffCalendarView {
  const fallback: StaffCalendarView = { version: 1, ownerId: "team", date: localDateKey(today), month: localDateKey(new Date(today.getFullYear(), today.getMonth(), 1)) };
  try {
    const value = JSON.parse(raw === undefined ? localStorage.getItem(STAFF_CALENDAR_VIEW_KEY) ?? "null" : raw ?? "null");
    if (value?.version !== 1) return fallback;
    const dateValid = (day: unknown): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) && localDateKey(parseLocalDate(day)) === day && day >= "1900-01-01" && day <= "2100-12-31";
    return { version: 1, ownerId: owners.some(owner => owner.id === value.ownerId) ? value.ownerId : "team", date: dateValid(value.date) ? value.date : fallback.date, month: dateValid(value.month) ? value.month.slice(0, 8) + "01" : fallback.month };
  } catch { return fallback; }
}

export function createStaffDemoEvents(now = new Date()): CalendarEvent[] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1), last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const events: CalendarEvent[] = [];
  const add = (date: Date, ownerId: string, title: string, startTime: string, endTime: string, type: EventType) => {
    const key = localDateKey(date), owner = owners.find(item => item.id === ownerId)!;
    events.push({ id: `staff-demo-${ownerId}-${key}-${type}`, title, date: key, startTime, endTime, type, ownerId, scope: owner.scope, allDay: false, description: "Демонстрационное событие командного расписания. Время и план можно изменить.", links: [], createdAt: now.toISOString(), updatedAt: now.toISOString() });
  };
  // Include adjacent grid days, but counters use only the displayed calendar month.
  const start = shiftDate(first, -(first.getDay() + 6) % 7), end = shiftDate(last, 6 - (last.getDay() + 6) % 7);
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const day = date.getDay(), inMonth = date.getMonth() === first.getMonth();
    if (day >= 1 && day <= 5) add(date, "team", "Тренировка", "12:00", "14:00", "training");
    if (day === 2 || day === 4) add(date, "team", "Разбор игры", "18:00", "19:00", "meeting");
    if (inMonth && day === 6 && date.getDate() >= 8 && date.getDate() <= 26) add(date, "team", "Матч ESL", "19:00", "22:00", "match");
  }
  // The initially selected demo day has three examples, without hard-coding a past date.
  const todayKey = localDateKey(now);
  if (!events.some(event => event.date === todayKey && event.type === "training")) add(now, "team", "Тренировка", "12:00", "14:00", "training");
  if (!events.some(event => event.date === todayKey && event.type === "meeting")) add(now, "team", "Разбор игры", "18:00", "19:00", "meeting");
  if (!events.some(event => event.date === todayKey && event.type === "match")) add(now, "team", "Матч ESL", "19:00", "22:00", "match");
  for (const day of [2, 6, 13, 20, 27]) add(new Date(now.getFullYear(), now.getMonth(), day), "staff-personal", "Планирование дня", "10:00", "11:00", "personal");
  for (const [id, days] of [["vexa", [1, 8, 15, 22]], ["frost", [2, 7, 13, 20, 27]], ["kairo", [4, 11, 18, 25]], ["mirage", [9]], ["zenn", [16]]] as [string, number[]][]) {
    for (const day of days) add(new Date(now.getFullYear(), now.getMonth(), day), `player-${id}`, "Индивидуальная работа", "16:00", "17:00", "training");
  }
  return events;
}

export const typeLabels: Record<EventType, string> = {
  theory: "Теория",
  practice: "Пракк",
  camp: "Сбор",
  personal: "Личное",
  psychologist: "Психолог",
  esea: "ESEA",
  training: "Тренировка",
  match: "Матч",
  recovery: "Восстановление",
  meeting: "Встреча",
  other: "Другое",
};

export const calendarLegend: EventType[] = ["theory", "practice", "camp", "personal", "psychologist", "esea"];

export const typeColors: Record<EventType, string> = {
  theory: "#4387ff", practice: "#39cdf6", camp: "#af7aff",
  personal: "#9aa6c2", psychologist: "#ff893e", esea: "#ffca3c",
  training: "#39cdf6", match: "#ffca3c", recovery: "#50d4aa",
  meeting: "#af7aff", other: "#9aa6c2",
};

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function shiftDate(base: Date, days: number) {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function demoEvent(
  id: string,
  title: string,
  offset: number,
  startTime: string,
  endTime: string,
  type: EventType,
  ownerId: string,
  description: string,
  links: string[] = [],
): CalendarEvent {
  const owner = owners.find((item) => item.id === ownerId) ?? owners[0];
  const now = new Date().toISOString();
  return {
    id,
    title,
    description,
    date: localDateKey(shiftDate(new Date(), offset)),
    startTime,
    endTime,
    allDay: false,
    type,
    ownerId,
    scope: owner.scope,
    links,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDemoStore(): CalendarStore {
  const now = new Date();
  // Populate the visual demo around the current month without pinning the calendar to a past date.
  const schedule: Array<[number, EventType, string, string]> = [
    [1, "practice", "20:00", "22:00"],
    [2, "personal", "17:00", "18:00"], [2, "theory", "19:00", "21:00"], [2, "practice", "21:00", "23:30"],
    [5, "theory", "17:00", "19:00"], [5, "practice", "20:00", "22:00"], [5, "camp", "23:00", "23:45"],
    [6, "theory", "17:00", "19:00"], [6, "camp", "23:00", "23:45"],
    [10, "theory", "17:00", "19:00"], [10, "camp", "23:00", "23:45"],
    [11, "theory", "17:00", "19:00"], [11, "practice", "20:00", "22:00"], [11, "camp", "23:00", "23:45"],
    [14, "theory", "17:00", "18:30"], [14, "psychologist", "19:00", "20:00"], [14, "camp", "23:00", "23:45"],
    [15, "practice", "20:00", "22:00"], [18, "camp", "23:00", "23:45"],
    [19, "theory", "17:00", "19:00"], [19, "camp", "23:00", "23:45"], [20, "practice", "20:00", "22:00"],
    [21, "theory", "17:00", "19:00"], [21, "camp", "23:00", "23:45"],
    [25, "theory", "17:00", "18:30"], [25, "esea", "19:00", "22:00"], [25, "camp", "23:00", "23:45"],
    [29, "theory", "17:00", "19:00"], [29, "camp", "23:00", "23:45"], [30, "camp", "23:00", "23:45"],
    [31, "theory", "17:00", "19:00"], [31, "practice", "20:00", "22:00"], [31, "camp", "23:00", "23:45"],
  ];
  const monthEvents = schedule.filter(([day]) => new Date(now.getFullYear(), now.getMonth(), day).getMonth() === now.getMonth() && day !== now.getDate()).map(([day, type, start, end]) => ({
    ...demoEvent(`demo-schedule-${day}-${type}`, typeLabels[type], 0, start, end, type, "personal", type === "practice" ? "Командная практика и разбор сыгранных карт." : "Детали и материалы встречи.", ["https://www.faceit.com/"]),
    date: localDateKey(new Date(now.getFullYear(), now.getMonth(), day)),
  }));
  const todayEvents = (["personal", "theory", "practice"] as EventType[]).map((type, index) => demoEvent(
    `demo-today-${type}`, typeLabels[type], 0, ["17:00", "19:00", "21:00"][index], ["18:00", "21:00", "23:30"][index], type, "personal",
    ["Личная работа и подготовка к тренировке.", "Разбор демо, тактики и подготовка карт.", "Командная практика и короткий разбор матчей."][index], ["https://www.faceit.com/"],
  ));

  return {
    version: 1,
    events: [...monthEvents, ...todayEvents, ...createStaffDemoEvents(now)],
    role: "player",
    notifications: [
      {
        id: "welcome-notification",
        title: "Календарь готов",
        message: "Нажмите на уведомление, чтобы открыть ближайшее событие.",
        eventId: "demo-today-personal",
        date: localDateKey(now),
        createdAt: now.toISOString(),
        read: false,
      },
    ],
  };
}

export function readStore(): CalendarStore {
  const fallback = createDemoStore();
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Partial<CalendarStore> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.events) || !Array.isArray(parsed.notifications)) return fallback;
    return { ...fallback, ...parsed, role: parsed.role === "manager" ? "manager" : "player" };
  } catch {
    return fallback;
  }
}

export function writeStore(store: CalendarStore) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = shiftDate(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => shiftDate(start, index));
}

export function eventDuration(event: CalendarEvent) {
  if (event.allDay) return "Весь день";
  const [startHour, startMinute] = event.startTime.split(":").map(Number);
  const [endHour, endMinute] = event.endTime.split(":").map(Number);
  const total = endHour * 60 + endMinute - startHour * 60 - startMinute;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return [hours ? `${hours} ч` : "", minutes ? `${minutes} мин` : ""].filter(Boolean).join(" ");
}
