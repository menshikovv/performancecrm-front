"use client";

import { CSSProperties, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";
import { CrmModal as Modal, CrmSidebar } from "../components/crm-ui";
import styles from "./calendar.module.css";
import staffStyles from "./staff-calendar.module.css";
import {
  CalendarEvent,
  CalendarNotification,
  CalendarStore,
  EventType,
  UserRole,
  calendarLegend,
  createDemoStore,
  eventDuration,
  localDateKey,
  owners,
  parseLocalDate,
  readStore,
  typeLabels,
  typeColors,
  writeStore,
  STAFF_CALENDAR_VIEW_KEY,
  STORAGE_KEY,
  StaffCalendarView,
  ownerTag,
  readStaffCalendarView,
  shiftDate,
  staffOwners,
} from "./calendar-data";

type IconName = "calendar" | "grid" | "users" | "chart" | "settings" | "plus" | "left" | "right" | "bell" | "close" | "clock" | "link" | "edit" | "trash" | "check" | "reset" | "menu" | "energy" | "heart" | "ball" | "card" | "sun" | "switch" | "fire" | "arrow" | "logo";

const iconPaths: Record<IconName, React.ReactNode> = {
  logo: <path d="m4 18 5-14 5 14 3-9 4 9M8 11l3 3 3-3" />,
  energy: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
  heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 12h4l2-4 4 8 2-4h6"/></>,
  ball: <><circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6 5-4ZM12 3v4M3 9l4 2M6 19l3-2M18 19l-3-2M21 9l-4 2"/></>,
  card: <><rect x="3" y="6" width="18" height="13" rx="1"/><path d="M3 10h18M6 14h5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
  switch: <><path d="M5 8h13l-3-3M19 16H6l3 3"/></>,
  fire: <path d="M12 2c1 5-4 7-4 11a4 4 0 0 0 8 0c0-1-.5-2-1-3 4 3 5 6 3 9a7 7 0 0 1-12-1C2 12 8 8 12 2Z"/>,
  arrow: <path d="M7 17 17 7M7 7h10v10"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3V10h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.17.62.73 1.03 1.37 1H21v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, left: <path d="m15 18-6-6 6-6"/>, right: <path d="m9 18 6-6-6-6"/>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  close: <path d="M18 6 6 18M6 6l12 12"/>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
  check: <path d="m5 12 4 4L19 6"/>, reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>, menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className={styles.icon} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const eventPlural = new Intl.PluralRules("ru-RU");
function eventCount(count: number) { return `${count} ${{ one: "событие", few: "события", many: "событий", other: "событий", zero: "событий", two: "события" }[eventPlural.select(count)]}`; }
function eventColor(type: EventType) { return { "--event-color": typeColors[type] } as CSSProperties; }

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime));
}

type EventDraft = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt" | "scope">;
const emptyDraft = (date: string, ownerId: string): EventDraft => ({ title: "", description: "", date, startTime: "10:00", endTime: "11:00", allDay: false, type: "training", ownerId, links: [] });

function EventForm({ event, selectedDate, defaultOwnerId, role, onCancel, onSave }: { event?: CalendarEvent; selectedDate: string; defaultOwnerId: string; role: UserRole; onCancel: () => void; onSave: (draft: EventDraft, revision: string | null) => void }) {
  const [revision] = useState(event?.updatedAt ?? null);
  const [draft, setDraft] = useState<EventDraft>(() => event ? { title: event.title, description: event.description, date: event.date, startTime: event.startTime, endTime: event.endTime, allDay: event.allDay, type: event.type, ownerId: event.ownerId, links: [...event.links] } : emptyDraft(selectedDate, defaultOwnerId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const addLink = () => update("links", [...draft.links, ""]);
  const validate = () => {
    const next: Record<string, string> = {};
    if (!draft.title.trim()) next.title = "Введите название события";
    if (!draft.date) next.date = "Выберите дату";
    if (!draft.allDay) {
      if (!draft.startTime) next.startTime = "Укажите время начала";
      if (!draft.endTime) next.endTime = "Укажите время окончания";
      if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) next.endTime = "Окончание должно быть позже начала. Переход через полночь не поддерживается";
    }
    draft.links.forEach((link, index) => { if (link.trim()) { try { const parsed = new URL(link); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch { next[`link-${index}`] = "Введите корректный URL, начинающийся с https://"; } } });
    setErrors(next); return Object.keys(next).length === 0;
  };
  const submit = (eventObject: FormEvent) => { eventObject.preventDefault(); if (validate()) onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim(), links: draft.links.map((link) => link.trim()).filter(Boolean) }, revision); };
  const templates: Array<{ label: string; type: EventType }> = [{ label: "Тренировка", type: "training" }, { label: "Матч", type: "match" }, { label: "Восстановление", type: "recovery" }, { label: "Встреча", type: "meeting" }];
  return <form onSubmit={submit} noValidate>
    <div className={styles.formBody}>
      <fieldset className={styles.templateField}><legend>Быстрый шаблон</legend><div className={styles.templates}>{templates.map((template) => <button key={template.type} type="button" onClick={() => setDraft((current) => ({ ...current, title: template.label, type: template.type }))}>{template.label}</button>)}</div></fieldset>
      <label className={styles.field}><span>Название *</span><input value={draft.title} onChange={(eventObject) => update("title", eventObject.target.value)} aria-invalid={Boolean(errors.title)} autoFocus />{errors.title && <small>{errors.title}</small>}</label>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Тип события</span><select value={draft.type} onChange={(eventObject) => update("type", eventObject.target.value as EventType)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {role === "manager" && <label className={styles.field}><span>Календарь</span><select aria-label="Календарь" value={draft.ownerId} onChange={(eventObject) => update("ownerId", eventObject.target.value)}>{staffOwners.map((owner) => <option key={owner.id} value={owner.id}>{ownerTag(owner.id)}</option>)}<optgroup label="Другие сохранённые календари">{owners.filter(owner => !staffOwners.some(item => item.id === owner.id)).map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</optgroup></select></label>}
      </div>
      <div className={styles.formGridThree}>
        <label className={styles.field}><span>Дата *</span><input type="date" value={draft.date} onChange={(eventObject) => update("date", eventObject.target.value)} aria-invalid={Boolean(errors.date)} />{errors.date && <small>{errors.date}</small>}</label>
        <label className={`${styles.field} ${draft.allDay ? styles.disabledField : ""}`}><span>Начало *</span><input type="time" value={draft.startTime} disabled={draft.allDay} onChange={(eventObject) => update("startTime", eventObject.target.value)} />{errors.startTime && <small>{errors.startTime}</small>}</label>
        <label className={`${styles.field} ${draft.allDay ? styles.disabledField : ""}`}><span>Окончание *</span><input type="time" value={draft.endTime} disabled={draft.allDay} onChange={(eventObject) => update("endTime", eventObject.target.value)} aria-invalid={Boolean(errors.endTime)} />{errors.endTime && <small>{errors.endTime}</small>}</label>
      </div>
      <label className={styles.checkRow}><input type="checkbox" checked={draft.allDay} onChange={(eventObject) => update("allDay", eventObject.target.checked)} /><span className={styles.fakeCheck}><Icon name="check" size={14} /></span><span>Весь день</span></label>
      <label className={styles.field}><span>Описание</span><textarea rows={4} value={draft.description} onChange={(eventObject) => update("description", eventObject.target.value)} placeholder="Добавьте детали, план или место встречи" /></label>
      <div className={styles.linksEditor}><div className={styles.labelRow}><span>Ссылки</span><button type="button" onClick={addLink}><Icon name="plus" size={16} /> Добавить</button></div>{draft.links.length === 0 && <p>Можно добавить ссылку на видеовстречу, матч или документ.</p>}{draft.links.map((linkValue, index) => <div className={styles.linkInput} key={index}><div><input aria-label={`Ссылка ${index + 1}`} value={linkValue} onChange={(eventObject) => update("links", draft.links.map((item, itemIndex) => itemIndex === index ? eventObject.target.value : item))} placeholder="https://" />{errors[`link-${index}`] && <small>{errors[`link-${index}`]}</small>}</div><button type="button" onClick={() => update("links", draft.links.filter((_, itemIndex) => itemIndex !== index))} aria-label="Удалить ссылку"><Icon name="trash" size={17} /></button></div>)}</div>
    </div>
    <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={onCancel}>Отмена</button><button className={styles.primaryButton} type="submit">{event ? "Сохранить изменения" : "Создать событие"}</button></div>
  </form>;
}

export default function CalendarApp() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const [hydrated, setHydrated] = useState(false);
  const [store, setStore] = useState<CalendarStore>(() => createDemoStore());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedOwnerId, setSelectedOwnerId] = useState("team");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"dayGridMonth" | "dayGridWeek">("dayGridMonth");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [storageError, setStorageError] = useState("");
  const calendarRef = useRef<FullCalendar>(null);
  const roleRef = useRef<UserRole>(store.role);
  roleRef.current = store.role;

  const updateStore = (change: (current: CalendarStore) => CalendarStore) => {
    try { const next = change(readStore()); writeStore(next); setStore(next); setStorageError(""); return true; }
    catch { setStorageError("Не удалось сохранить изменения. Проверьте доступ к хранилищу и свободное место в браузере."); return false; }
  };
  const saveStaffView = (patch: Partial<StaffCalendarView>) => {
    try { localStorage.setItem(STAFF_CALENDAR_VIEW_KEY, JSON.stringify({ ...readStaffCalendarView(), ...patch })); }
    catch { setStorageError("Не удалось сохранить настройки Staff-календаря. События не изменены."); }
  };

  useLayoutEffect(() => {
    const saved = readStore();
    const params = new URLSearchParams(window.location.search);
    if (params.get("role") === "staff" || params.get("role") === "player") saved.role = params.get("role") === "staff" ? "manager" : "player";
    try { writeStore(saved); } catch { setStorageError("Локальное сохранение недоступно. Изменения могут не сохраниться."); }
    setStore(saved);
    if (saved.role === "manager") {
      const view = readStaffCalendarView(); setSelectedOwnerId(view.ownerId); setSelectedDate(view.date); setVisibleMonth(parseLocalDate(view.month));
    }
    const eventId = params.get("event");
    const event = saved.events.find((item) => item.id === eventId);
    if (event) {
      setDetailsId(event.id);
      setSelectedDate(event.date);
      const eventDate = parseLocalDate(event.date);
      setVisibleMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
      setSelectedOwnerId(event.ownerId);
      if (saved.role === "manager") saveStaffView({ ownerId: event.ownerId, date: event.date, month: event.date.slice(0, 8) + "01" });
      calendarRef.current?.getApi().gotoDate(event.date);
    }
    setHydrated(true);
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) setStore(readStore()); };
    const focus = () => setStore(readStore());
    window.addEventListener("storage", sync); window.addEventListener("focus", focus);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", focus); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!hydrated || store.role !== "manager") return;
    const view = readStaffCalendarView(); setSelectedOwnerId(view.ownerId); setSelectedDate(view.date); setCalendarView("dayGridMonth"); calendarRef.current?.getApi().changeView("dayGridMonth", view.month);
  }, [hydrated, store.role]);
  useEffect(() => {
    if (!hydrated) return;
    const checkUpcoming = () => {
      const now = new Date();
      const upcoming = store.events.find((event) => {
        if (store.role === "player" && event.ownerId !== "personal") return false;
        if (event.allDay) return false;
        const candidate = parseLocalDate(event.date); const [hours, minutes] = event.startTime.split(":").map(Number); candidate.setHours(hours, minutes, 0, 0);
        const difference = candidate.getTime() - now.getTime();
        return difference > 0 && difference <= 60 * 60 * 1000 && !store.notifications.some((notification) => notification.id === `upcoming-${event.id}`);
      });
      if (!upcoming) return;
      const notification: CalendarNotification = { id: `upcoming-${upcoming.id}`, title: "Событие скоро начнётся", message: `${upcoming.title} — в ${upcoming.startTime}`, eventId: upcoming.id, date: upcoming.date, createdAt: now.toISOString(), read: false };
      const saved = updateStore((current) => current.notifications.some(item => item.id === notification.id) ? current : ({ ...current, notifications: [notification, ...current.notifications] }));
      if (saved && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(notification.title, { body: notification.message });
    };
    checkUpcoming(); const timer = window.setInterval(checkUpcoming, 60_000); return () => window.clearInterval(timer);
  }, [hydrated, store.events, store.notifications, store.role]);

  const role = store.role;
  const effectiveOwnerId = role === "player" ? "personal" : selectedOwnerId;
  const filteredEvents = useMemo(() => store.events.filter((event) => event.ownerId === effectiveOwnerId), [store.events, effectiveOwnerId]);
  const dayEvents = useMemo(() => sortEvents(filteredEvents.filter((event) => event.date === selectedDate)), [filteredEvents, selectedDate]);
  const selectedEvent = detailsId && !deleteId ? store.events.find((event) => event.id === detailsId) : undefined;
  const editingEvent = editingId && editingId !== "new" ? store.events.find((event) => event.id === editingId) : undefined;
  const unreadCount = store.notifications.filter((notification) => !notification.read).length;
  const monthActivity = new Set(filteredEvents.filter((event) => event.date.startsWith(`${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`)).map((event) => event.date)).size;
  const nextEvents = useMemo(() => {
    const now = today.getTime();
    return [...filteredEvents].filter((event) => new Date(`${event.date}T${event.allDay ? "23:59" : event.startTime}`).getTime() >= now)
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  }, [filteredEvents, today]);
  const nearestEvent = nextEvents[0];
  const nextTraining = nextEvents.find((event) => ["training", "practice"].includes(event.type) && event.id !== nearestEvent?.id);
  const shownStaffOwners = staffOwners.some(owner => owner.id === selectedOwnerId) ? staffOwners : [...staffOwners, owners.find(owner => owner.id === selectedOwnerId)!].filter(Boolean);
  const monthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;

  const chooseOwner = (ownerId: string) => { setSelectedOwnerId(ownerId); saveStaffView({ ownerId }); };
  const changeRole = (nextRole: UserRole) => {
    if (!updateStore(current => ({ ...current, role: nextRole }))) return;
    const view = readStaffCalendarView(); const date = nextRole === "manager" ? view.date : todayKey;
    setSelectedOwnerId(nextRole === "manager" ? view.ownerId : "personal"); setSelectedDate(date); setCalendarView("dayGridMonth"); calendarRef.current?.getApi().changeView("dayGridMonth", nextRole === "manager" ? view.month : date);
    const url = new URL(location.href); url.searchParams.delete("role"); url.searchParams.delete("event"); window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    setToast(nextRole === "manager" ? "Включён режим Staff" : "Включён режим игрока");
  };
  const selectDate = (date: Date) => { const key = localDateKey(date); setSelectedDate(key); if (roleRef.current === "manager") saveStaffView({ date: key }); const current = calendarRef.current?.getApi().getDate() ?? visibleMonth; if (date.getMonth() !== current.getMonth() || date.getFullYear() !== current.getFullYear()) { calendarRef.current?.getApi().gotoDate(date); setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1)); } };
  const goToday = () => { calendarRef.current?.getApi().today(); setSelectedDate(todayKey); if (role === "manager") saveStaffView({ date: todayKey }); };
  const changeMonth = (delta: number) => { const api = calendarRef.current?.getApi(); if (delta < 0) api?.prev(); else api?.next(); };
  const changeView = (view: "dayGridMonth" | "dayGridWeek") => { setCalendarView(view); calendarRef.current?.getApi().changeView(view, selectedDate); };
  const openCreate = () => { setDetailsId(null); setEditingId("new"); };
  const openEvent = (id: string) => { const event = store.events.find((item) => item.id === id); if (event) { setSelectedDate(event.date); calendarRef.current?.getApi().gotoDate(event.date); if (role === "manager") { chooseOwner(event.ownerId); saveStaffView({ date: event.date }); } } setEditingId(null); setDetailsId(id); };
  const saveEvent = (draft: EventDraft, revision: string | null) => {
    const currentEvent = editingId && editingId !== "new" ? readStore().events.find(event => event.id === editingId) : undefined;
    if (editingId !== "new" && (!currentEvent || currentEvent.updatedAt !== revision)) { setStorageError("Событие изменено или удалено в другой вкладке. Скопируйте правки и откройте его актуальную версию."); return; }
    const owner = owners.find((item) => item.id === (role === "player" ? "personal" : draft.ownerId)) ?? owners[0];
    const now = new Date().toISOString();
    const isEditing = Boolean(editingEvent);
    const nextEvent: CalendarEvent = { ...draft, ownerId: owner.id, scope: owner.scope, id: editingEvent?.id ?? uid("event"), createdAt: editingEvent?.createdAt ?? now, updatedAt: now };
    const playerScheduleChanged = isEditing && role === "manager" && owner.scope === "player";
    if (!updateStore((current) => ({ ...current, events: isEditing ? current.events.map((event) => event.id === nextEvent.id ? nextEvent : event) : [...current.events, nextEvent], notifications: [{ id: uid("notification"), title: playerScheduleChanged ? "Расписание игрока обновлено" : isEditing ? "Событие изменено" : "Событие создано", message: `${nextEvent.title} — ${nextEvent.date}. Изменение сохранено в демоленте этого браузера.`, eventId: nextEvent.id, date: nextEvent.date, createdAt: now, read: false }, ...current.notifications] }))) return;
    if (role === "manager") { chooseOwner(owner.id); saveStaffView({ date: nextEvent.date }); }
    setSelectedDate(nextEvent.date); const date = parseLocalDate(nextEvent.date); setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    calendarRef.current?.getApi().gotoDate(nextEvent.date);
    setEditingId(null); setDetailsId(nextEvent.id);
    setToast(playerScheduleChanged ? "Расписание игрока изменено. Запись добавлена в демоленту уведомлений" : isEditing ? "Изменения сохранены" : "Событие создано");
  };
  const deleteEvent = () => {
    const event = store.events.find((item) => item.id === deleteId); if (!event) return;
    if (!updateStore((current) => ({ ...current, events: current.events.filter((item) => item.id !== event.id), notifications: [{ id: uid("notification"), title: "Событие удалено", message: event.title, createdAt: new Date().toISOString(), read: false }, ...current.notifications] }))) return;
    setDeleteId(null); setDetailsId(null); setToast("Событие удалено");
  };
  const resetDemo = () => { const next = createDemoStore(); next.role = role; if (!updateStore(() => next)) return; setSelectedDate(todayKey); calendarRef.current?.getApi().gotoDate(todayKey); setSelectedOwnerId(role === "manager" ? "team" : "personal"); if (role === "manager") saveStaffView({ ownerId: "team", date: todayKey }); setMobileMenu(false); setSettingsOpen(false); setToast("Демоданные восстановлены"); };
  const clickNotification = (notification: CalendarNotification) => { updateStore((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item) })); setNotificationsOpen(false); if (notification.eventId && store.events.some((event) => event.id === notification.eventId)) openEvent(notification.eventId); else setToast("Это событие уже удалено из календаря"); };
  const requestNotifications = async () => { if (typeof Notification === "undefined") { setToast("Браузерные уведомления не поддерживаются"); return; } const permission = await Notification.requestPermission(); setToast(permission === "granted" ? "Уведомления браузера включены" : "Календарь продолжит показывать уведомления внутри приложения"); };
  const fullCalendarEvents = useMemo(() => filteredEvents.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.allDay ? event.date : `${event.date}T${event.startTime}`,
    end: event.allDay ? undefined : `${event.date}T${event.endTime}`,
    allDay: event.allDay,
    classNames: [`calendar-event-${event.type}`],
    extendedProps: { type: event.type },
  })), [filteredEvents]);

  if (!hydrated) return <main className={styles.app} aria-busy="true"><section className={styles.workspace}><p role="status">Загрузка календаря…</p></section></main>;

  return <main className={styles.app} aria-busy={!hydrated}>
    <header className={styles.mobileHeader}><div className={styles.brandMark}><Icon name="logo" size={25} /></div><strong>Performance CRM</strong><button className={styles.iconButton} onClick={() => setMobileMenu((value) => !value)} aria-label={mobileMenu ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileMenu}><Icon name={mobileMenu ? "close" : "menu"} /></button></header>
    {mobileMenu && <button className={styles.menuBackdrop} aria-label="Закрыть меню" onClick={() => setMobileMenu(false)} />}
    <CrmSidebar active="calendar" role={role} mobileOpen={mobileMenu} onClose={() => setMobileMenu(false)} onSwitchRole={() => changeRole(role === "player" ? "manager" : "player")} onSettings={() => setSettingsOpen(true)} onSection={(section) => router.push(`/overview?section=${section}`)} />

    <section className={`${styles.workspace} ${role === "manager" ? staffStyles.workspace : ""}`}>
      {role === "manager" ? <>
        <header className={staffStyles.header}><div><div className={staffStyles.context}><span>Staff</span>Atlant Esports · события команды, игроков и личные</div><h1>Календарь</h1></div><button className={styles.primaryButton} onClick={openCreate}><Icon name="plus" size={20}/>Создать событие</button></header>
        <div className={staffStyles.filters} role="group" aria-label="Фильтр календаря">{shownStaffOwners.map(owner => <button key={owner.id} className={selectedOwnerId === owner.id ? staffStyles.active : ""} aria-pressed={selectedOwnerId === owner.id} onClick={() => chooseOwner(owner.id)} title="Количество событий в выбранном месяце">{ownerTag(owner.id)}<span>{store.events.filter(event => event.ownerId === owner.id && event.date.startsWith(monthKey)).length}</span></button>)}</div>
      </> : <>
      <div className={styles.topbar}>
        <button className={styles.upcomingEvent} onClick={() => nearestEvent ? openEvent(nearestEvent.id) : openCreate()} aria-label={nearestEvent ? `Открыть ближайшее событие: ${nearestEvent.title}` : "Создать событие"}>
          <Icon name="calendar" size={22} /><span><strong>{nearestEvent?.title ?? "Пока нет событий"} {nearestEvent && <em>{nearestEvent.allDay ? "Весь день" : nearestEvent.startTime}</em>}</strong><small>{nextTraining ? `След. тренировка ${nextTraining.date !== todayKey ? shortDateFormatter.format(parseLocalDate(nextTraining.date)) + " · " : ""}${nextTraining.startTime}` : nearestEvent ? shortDateFormatter.format(parseLocalDate(nearestEvent.date)) : "Добавьте событие в календарь"}</small></span><Icon name="arrow" size={17} />
        </button>
        <button className={styles.activityButton} onClick={() => setToast(`В этом месяце ${monthActivity} дней с событиями`)} aria-label={`Дней с событиями в этом месяце: ${monthActivity}`} title="Дней с событиями в этом месяце"><Icon name="fire" size={21} /><strong>{monthActivity}</strong></button>
        <button className={styles.notificationButton} onClick={() => setNotificationsOpen(true)} aria-label={`Уведомления: ${unreadCount} непрочитанных`}><Icon name="bell" size={22} />{unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
      </div>
      <div className={styles.calendarToolbar}>
        <div className={styles.monthNavigation}><h1 aria-label={`Календарь: ${monthFormatter.format(visibleMonth)} ${visibleMonth.getFullYear()}`}>{monthFormatter.format(visibleMonth)}</h1><span className={styles.year}>{visibleMonth.getFullYear()}</span><div className={styles.monthArrows}><button onClick={() => changeMonth(-1)} aria-label={calendarView === "dayGridMonth" ? "Предыдущий месяц" : "Предыдущая неделя"}><Icon name="left" /></button><button onClick={() => changeMonth(1)} aria-label={calendarView === "dayGridMonth" ? "Следующий месяц" : "Следующая неделя"}><Icon name="right" /></button></div></div>
        <div className={styles.viewSwitch} role="group" aria-label="Вид календаря"><button aria-pressed={calendarView === "dayGridMonth"} className={calendarView === "dayGridMonth" ? styles.viewActive : ""} onClick={() => changeView("dayGridMonth")}>Месяц</button><button aria-pressed={calendarView === "dayGridWeek"} className={calendarView === "dayGridWeek" ? styles.viewActive : ""} onClick={() => changeView("dayGridWeek")}>Неделя</button></div>
      </div>
      <div className={styles.legend} aria-label="Категории событий">{calendarLegend.map((type) => <span key={type}><i style={{ background: typeColors[type] }} />{typeLabels[type]}</span>)}</div>
      </>}
      {storageError && <p className={staffStyles.error} role="alert">{storageError}</p>}

      <div className={`${styles.contentGrid} ${role === "manager" ? staffStyles.layout : ""}`}>
        <section className={`${styles.calendarCard} ${role === "manager" ? staffStyles.calendarCard : ""}`} aria-label="Календарь месяца">
          {role === "manager" && <header className={staffStyles.monthHeader}><h2>{monthFormatter.format(visibleMonth)} {visibleMonth.getFullYear()}</h2><div><button className={styles.iconButton} aria-label="Предыдущий месяц" onClick={() => changeMonth(-1)}><Icon name="left"/></button><button className={styles.secondaryButton} onClick={goToday}>Сегодня</button><button className={styles.iconButton} aria-label="Следующий месяц" onClick={() => changeMonth(1)}><Icon name="right"/></button></div></header>}
          <div className={styles.fullCalendar}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate={visibleMonth}
              headerToolbar={false}
              firstDay={1}
              fixedWeekCount={false}
              showNonCurrentDates
              dayMaxEvents={role === "manager" ? 2 : 3}
              height="auto"
              locale={ruLocale}
              eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              events={fullCalendarEvents}
              datesSet={(info) => { const month = new Date(info.view.currentStart.getFullYear(), info.view.currentStart.getMonth(), 1); setVisibleMonth(month); if (role === "manager") saveStaffView({ month: localDateKey(month) }); }}
              dateClick={(info) => selectDate(info.date)}
              eventClick={(info) => openEvent(info.event.id)}
              dayHeaderContent={(info) => <span>{["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"][info.date.getDay()]}{calendarView === "dayGridWeek" && <b>{info.date.getDate()}</b>}</span>}
              dayCellContent={(info) => role === "manager" ? String(info.date.getDate()) : String(info.date.getDate()).padStart(2, "0")}
              dayCellDidMount={(info) => { info.el.tabIndex = 0; info.el.setAttribute("aria-label", `Выбрать дату: ${fullDateFormatter.format(info.date)}`); info.el.onkeydown = (event) => { if (event.target !== info.el) return; const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]; if (offset !== undefined) { event.preventDefault(); const date = shiftDate(info.date, offset); selectDate(date); requestAnimationFrame(() => document.querySelector<HTMLElement>(`.fc-daygrid-day[data-date="${localDateKey(date)}"]`)?.focus()); } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDate(info.date); } }; }}
              dayCellWillUnmount={(info) => { info.el.onkeydown = null; }}
              dayCellClassNames={(info) => localDateKey(info.date) === selectedDate ? [styles.fullCalendarSelectedDay] : []}
              eventContent={(info) => <div className={styles.eventContent} style={eventColor(info.event.extendedProps.type as EventType)}><i /><span>{info.event.allDay ? "Весь день" : info.timeText} {info.event.title}</span></div>}
              moreLinkContent={(info) => role === "manager" ? `+${info.num} ещё` : `ещё ${info.num}`}
              moreLinkClick={(info) => { selectDate(info.date); return "popover"; }}
            />
          </div>
        </section>

        {role === "manager" ? <aside className={staffStyles.agendaColumn} aria-label="Расписание выбранного дня"><section className={staffStyles.agenda}>
          <h2>{selectedDate === todayKey ? "Сегодня, " : ""}{shortDateFormatter.format(parseLocalDate(selectedDate))}</h2><p className={staffStyles.dayMeta}>{weekdayFormatter.format(parseLocalDate(selectedDate))} · тэг {ownerTag(effectiveOwnerId)}</p>
          <div className={staffStyles.eventList}>{dayEvents.length ? dayEvents.map(event => <button key={event.id} className={staffStyles.event} style={eventColor(event.type)} aria-label={event.title} onClick={() => openEvent(event.id)}><span><strong>{event.title}</strong><small>{event.allDay ? "Весь день" : `${event.startTime} – ${event.endTime}`} · {ownerTag(event.ownerId)}</small></span><Icon name="right" size={18}/></button>) : <div className={staffStyles.empty}><Icon name="calendar" size={30}/><h3>На этот день событий нет</h3><p>Выберите другую дату или добавьте событие.</p></div>}</div>
          <button className={styles.secondaryButton} onClick={openCreate}><Icon name="plus" size={15}/>Событие на эту дату</button>
        </section><p className={staffStyles.note}>Напоминания за час до начала работают, пока календарь открыт. Изменения сохраняются в демоленте уведомлений этого браузера. Отправка игрокам и общий доступ пока не подключены.</p>{selectedDate !== todayKey && <button className={styles.backToToday} onClick={goToday}>Вернуться к сегодняшнему дню</button>}</aside> : <aside className={styles.agenda}>
          <div className={styles.agendaHeader}><div><h2>{selectedDate === todayKey ? "Сегодня, " : ""}{shortDateFormatter.format(parseLocalDate(selectedDate))}</h2><p>{weekdayFormatter.format(parseLocalDate(selectedDate))} · {eventCount(dayEvents.length)}</p></div><button className={styles.addEventButton} onClick={openCreate} aria-label="Создать событие" title="Создать событие"><Icon name="plus" size={24} /></button></div>
          <div className={styles.agendaList}>{dayEvents.length ? dayEvents.map((event) => <article key={event.id} className={styles.agendaEvent} style={eventColor(event.type)}><div className={styles.agendaEventHeading}><button onClick={() => openEvent(event.id)}>{event.title}</button><time>{event.allDay ? "Весь день" : `${event.startTime}–${event.endTime}`}</time></div><div className={styles.agendaActions}>{event.links.length ? <a className={styles.eventLink} href={event.links[0]} target="_blank" rel="noopener noreferrer"><Icon name="link" size={16} /> Ссылка</a> : <button className={styles.eventLink} onClick={() => openEvent(event.id)}><Icon name="calendar" size={16} /> Подробнее</button>}<button className={styles.smallIconButton} onClick={() => { setDetailsId(null); setEditingId(event.id); }} aria-label={`Редактировать: ${event.title}`} title="Редактировать"><Icon name="edit" size={17} /></button><button className={styles.smallIconButton} onClick={() => setDeleteId(event.id)} aria-label={`Удалить: ${event.title}`} title="Удалить"><Icon name="trash" size={16} /></button></div></article>) : <div className={styles.emptyAgenda}><div><Icon name="calendar" size={28} /></div><h3>Нет событий</h3><p>Добавьте тренировку, встречу или личное событие.</p><button className={styles.secondaryButton} onClick={openCreate}><Icon name="plus" size={16} /> Добавить событие</button></div>}</div>
          {selectedDate !== todayKey && <button className={styles.backToToday} onClick={goToday}>Вернуться к сегодняшнему дню</button>}
        </aside>}
      </div>
    </section>

    {selectedEvent && <Modal title="Событие" onClose={() => setDetailsId(null)}><div className={styles.detailsBody}><div className={styles.typeBadge} style={eventColor(selectedEvent.type)}>{typeLabels[selectedEvent.type]}</div><h3>{selectedEvent.title}</h3><div className={styles.detailFacts}><div><Icon name="calendar" /><span><b>{fullDateFormatter.format(parseLocalDate(selectedEvent.date))}</b><small>{parseLocalDate(selectedEvent.date).getFullYear()}</small></span></div><div><Icon name="clock" /><span><b>{selectedEvent.allDay ? "Весь день" : `${selectedEvent.startTime} — ${selectedEvent.endTime}`}</b><small>{eventDuration(selectedEvent)}</small></span></div><div><span className={styles.ownerDot} style={{ background: owners.find((item) => item.id === selectedEvent.ownerId)?.color }} /><span><b>{owners.find((item) => item.id === selectedEvent.ownerId)?.name}</b><small>Календарь</small></span></div></div>{selectedEvent.description && <section><span>Описание</span><p>{selectedEvent.description}</p></section>}{selectedEvent.links.length > 0 && <section><span>Ссылки</span>{selectedEvent.links.map((linkValue) => <a key={linkValue} href={linkValue} target="_blank" rel="noopener noreferrer"><Icon name="link" size={17} />{linkValue}</a>)}</section>}</div><div className={styles.modalActions}><button className={styles.dangerButton} onClick={() => setDeleteId(selectedEvent.id)}><Icon name="trash" size={17} /> Удалить</button><button className={styles.primaryButton} onClick={() => { setDetailsId(null); setEditingId(selectedEvent.id); }}><Icon name="edit" size={17} /> Редактировать</button></div></Modal>}
    {editingId && <Modal title={editingEvent ? "Редактировать событие" : "Новое событие"} onClose={() => setEditingId(null)} wide>{storageError && <p className={staffStyles.error} role="alert">{storageError}</p>}<EventForm event={editingEvent} selectedDate={selectedDate} defaultOwnerId={effectiveOwnerId} role={role} onCancel={() => setEditingId(null)} onSave={saveEvent} /></Modal>}
    {deleteId && <Modal title="Удалить событие?" onClose={() => setDeleteId(null)}><div className={styles.confirmBody}><div><Icon name="trash" /></div><p>Это действие нельзя отменить. Событие исчезнет из календаря на этом устройстве.</p></div><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => setDeleteId(null)}>Отмена</button><button className={styles.dangerSolidButton} onClick={deleteEvent}>Удалить</button></div></Modal>}
    {settingsOpen && <Modal title="Настройки календаря" onClose={() => setSettingsOpen(false)}><div className={styles.settingsBody}><div><h3>Уведомления</h3><p>Напоминания за час до события работают, пока календарь открыт.</p><button className={styles.secondaryButton} onClick={requestNotifications}><Icon name="bell" size={17} /> Включить уведомления</button><button className={styles.secondaryButton} onClick={() => { setSettingsOpen(false); setNotificationsOpen(true); }}>Открыть уведомления · {unreadCount}</button></div>{role === "manager" && <label className={styles.field}><span>Другой календарь</span><select aria-label="Другой календарь" value={effectiveOwnerId} onChange={event => { chooseOwner(event.target.value); setSettingsOpen(false); }}>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select><small>В том числе календари из предыдущей версии демо. Записи не удаляются и не меняют владельца.</small></label>}<div><h3>Демонстрационные данные</h3><p>Восстановите пример расписания. Созданные на этом устройстве события будут заменены.</p><button className={styles.secondaryButton} onClick={() => { setSettingsOpen(false); setResetOpen(true); }}><Icon name="reset" size={17} /> Восстановить пример</button></div></div></Modal>}
    {resetOpen && <Modal title="Восстановить пример расписания?" onClose={() => setResetOpen(false)}><div className={styles.confirmBody}><p>События на этом устройстве будут заменены демонстрационным расписанием. Это действие нельзя отменить.</p></div><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => setResetOpen(false)}>Отмена</button><button className={styles.primaryButton} onClick={() => { resetDemo(); setResetOpen(false); }}>Восстановить</button></div></Modal>}
    {notificationsOpen && <Modal title="Уведомления" onClose={() => setNotificationsOpen(false)}><div className={styles.notificationIntro}><p>Включите уведомления браузера, чтобы не пропустить событие.</p><button onClick={requestNotifications}>Включить</button></div><div className={styles.notificationList}>{store.notifications.length ? store.notifications.map((notification) => <button key={notification.id} className={!notification.read ? styles.unreadNotification : ""} onClick={() => clickNotification(notification)}><i /><span><strong>{notification.title}</strong><small>{notification.message}</small></span><time>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(notification.createdAt))}</time></button>) : <div className={styles.emptyAgenda}><h3>Нет новых уведомлений</h3><p>Здесь появятся изменения расписания и напоминания.</p></div>}</div><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => updateStore((current) => ({ ...current, notifications: current.notifications.map((notification) => ({ ...notification, read: true })) }))}>Отметить все прочитанными</button></div></Modal>}
    {toast && <div className={styles.toast} role="status" aria-live="polite"><span><Icon name="check" size={17} /></span>{toast}</div>}
  </main>;
}
