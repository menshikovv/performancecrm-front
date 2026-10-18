"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, useEffect, useState } from "react";
import { CrmIcon as Icon, CrmModal as Modal, CrmSidebar } from "../components/crm-ui";
import { CheckInForm } from "../components/check-in-form";
import { CalendarStore, readStore, STORAGE_KEY, writeStore } from "../calendar/calendar-data";
import { OverviewStore, dateKey, dateOffset, mean, OVERVIEW_STORAGE_KEY, parseDate, readOverviewStore, streakDays } from "../overview/overview-data";
import { CheckIn, DaySlot, readTestsStore, slotLabels, TESTS_STORAGE_KEY, TestsStore, weekKey } from "../tests/tests-data";
import { daySlots, overviewWithCheckins, slotDescriptions, slotPrompts, summarizeDay, withCheckIn } from "./mood-data";
import shell from "../calendar/calendar.module.css";
import styles from "./mood.module.css";

const fullDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const shortWeekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const slotColors: Record<DaySlot, string> = { morning: "#4688ff", afternoon: "#32d0f5", evening: "#af78ff" };
const slotIcons = { morning: "sunrise", afternoon: "sun", evening: "moon" } as const;

function rangeLabel(start: string, today: Date) {
  const first = parseDate(start), last = dateOffset(first, 6);
  const label = `${shortDate.format(first)} – ${shortDate.format(last)}`.replace(/\./g, "");
  return first.getFullYear() === today.getFullYear() && last.getFullYear() === today.getFullYear() ? label : `${label} · ${first.getFullYear() === last.getFullYear() ? first.getFullYear() : `${first.getFullYear()}–${last.getFullYear()}`}`;
}

function SlotCard({ slot, entry, onEdit }: { slot: DaySlot; entry?: CheckIn; onEdit: () => void }) {
  return <article className={styles.slotCard} style={{ "--slot-color": slotColors[slot] } as CSSProperties}>
    <header>
      <span className={styles.slotIcon}><Icon name={slotIcons[slot]} size={25}/></span>
      <div><h3>{slotLabels[slot]}</h3><p>{slotDescriptions[slot]}</p></div>
      <span className={styles.slotStatus}>{entry ? "Заполнено" : "Пусто"}</span>
    </header>
    {entry ? <>
      {(["mood", "energy"] as const).map(key => <div className={styles.rating} key={key}>
        <div><span>{key === "mood" ? "Настроение" : "Энергия"}</span><strong>{entry[key]} <small>/ 10</small></strong></div>
        <div role="meter" aria-label={`${slotLabels[slot]}: ${key === "mood" ? "настроение" : "энергия"}`} aria-valuemin={1} aria-valuemax={10} aria-valuenow={entry[key]}><i style={{ width: `${entry[key] * 10}%` }}/></div>
      </div>)}
      {entry.note && <p className={styles.savedNote}>{entry.note}</p>}
      <button className={styles.editButton} onClick={onEdit} aria-label={`Изменить отметку: ${slotLabels[slot]}`}><Icon name="edit" size={15}/> Изменить</button>
    </> : <><p className={styles.emptySlot}>{slotPrompts[slot]}</p><button className={shell.primaryButton} onClick={onEdit} aria-label={`Добавить отметку: ${slotLabels[slot]}`}><Icon name="plus" size={17}/> Добавить</button></>}
  </article>;
}

export default function MoodApp() {
  const router = useRouter();
  const [today, setToday] = useState<Date | null>(null);
  const [store, setStore] = useState<TestsStore | null>(null);
  const [overview, setOverview] = useState<OverviewStore | null>(null);
  const [calendar, setCalendar] = useState<CalendarStore | null>(null);
  const [week, setWeek] = useState("");
  const [selected, setSelected] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editing, setEditing] = useState<DaySlot | null>(null);
  const [info, setInfo] = useState<"settings" | "notifications" | "streak" | "plans" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      const now = new Date();
      setToday(now); setStore(readTestsStore(now)); setOverview(readOverviewStore(now)); setCalendar(readStore());
    };
    const frame = requestAnimationFrame(() => {
      load();
      const now = new Date(), requested = new URLSearchParams(location.search).get("date");
      const initial = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && dateKey(parseDate(requested)) === requested && requested <= dateKey(now) ? requested : dateKey(now);
      setSelected(initial); setWeek(weekKey(parseDate(initial)));
    });
    const sync = (event: StorageEvent) => { if ([TESTS_STORAGE_KEY, OVERVIEW_STORAGE_KEY, STORAGE_KEY, null].includes(event.key)) load(); };
    const onFocus = () => load();
    window.addEventListener("storage", sync); window.addEventListener("focus", onFocus);
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); window.removeEventListener("storage", sync); window.removeEventListener("focus", onFocus); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const day = document.getElementById(`mood-day-${selected}`);
    const grid = day?.parentElement;
    if (day && grid && grid.scrollWidth > grid.clientWidth) grid.scrollTo({ left: Math.max(0, day.offsetLeft - (grid.clientWidth - day.clientWidth) / 2), behavior: "instant" });
  }, [selected]);

  const ready = !!today && !!store && !!overview && !!calendar && !!selected && !!week;
  const todayKey = today ? dateKey(today) : "";
  const days = week ? Array.from({ length: 7 }, (_, index) => dateKey(dateOffset(parseDate(week), index))) : [];
  const summaries = store ? days.map(date => ({ date, ...summarizeDay(store.checkins, date) })) : [];
  const loggedDays = summaries.filter(day => day.entries.length);
  const weekEntries = loggedDays.flatMap(day => day.entries);
  const averageMood = weekEntries.length ? mean(weekEntries.map(entry => entry.mood)) : null;
  const averageEnergy = weekEntries.length ? mean(weekEntries.map(entry => entry.energy)) : null;
  const todayCount = store ? summarizeDay(store.checkins, todayKey).entries.length : 0;
  const selectedEntries = store ? summarizeDay(store.checkins, selected).entries : [];
  const role = calendar?.role ?? "player";
  const unread = calendar?.notifications.filter(item => !item.read).length ?? 0;
  const upcoming = [...(calendar?.events ?? [])].filter(event => event.ownerId === "personal" && today && new Date(`${event.date}T${event.allDay ? "23:59" : event.startTime}`).getTime() >= today.getTime()).sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  const nearest = upcoming[0];
  const training = upcoming.find(event => event.type === "practice" || event.type === "training");

  const switchRole = () => {
    const next = { ...(calendar ?? readStore()), role: role === "player" ? "manager" as const : "player" as const };
    setCalendar(next); writeStore(next);
  };
  const changeWeek = (offset: number) => {
    if (!today) return;
    const nextWeek = dateKey(dateOffset(parseDate(week), offset * 7));
    if (nextWeek > weekKey(today)) return;
    const sameDay = dateKey(dateOffset(parseDate(selected), offset * 7));
    setWeek(nextWeek); setSelected(sameDay > todayKey ? todayKey : sameDay);
  };
  const save = (item: CheckIn) => {
    if (!store || !today || item.date > dateKey(new Date())) return;
    const next = withCheckIn(store, item);
    const nextOverview = overviewWithCheckins(readOverviewStore(today), next.checkins, item.date);
    setStore(next); setOverview(nextOverview); setEditing(null);
    let testsSaved = true, overviewSaved = true;
    try { localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(next)); } catch { testsSaved = false; }
    try { localStorage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(nextOverview)); } catch { overviewSaved = false; }
    setToast(!testsSaved ? "Отметка добавлена, но не сохранится после закрытия страницы. Проверьте память браузера." : !overviewSaved ? "Отметка сохранена. Не удалось обновить обзор в памяти браузера." : "Отметка сохранена. Тесты и обзор обновлены.");
  };

  return <main className={`${shell.app} ${styles.app}`} aria-busy={!ready}>
    <header className={shell.mobileHeader}><div className={shell.brandMark}><Icon name="logo" size={25}/></div><strong>Performance CRM</strong><button className={shell.iconButton} onClick={() => setMobileMenu(value => !value)} aria-label={mobileMenu ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileMenu}><Icon name={mobileMenu ? "close" : "menu"}/></button></header>
    {mobileMenu && <button className={shell.menuBackdrop} onClick={() => setMobileMenu(false)} aria-label="Закрыть меню"/>}
    <CrmSidebar active="mood" role={role} mobileOpen={mobileMenu} onClose={() => setMobileMenu(false)} onSwitchRole={switchRole} onSettings={() => setInfo("settings")} onSection={name => name === "plans" ? setInfo("plans") : router.push(`/overview?section=${name}`)}/>
    <section className={`${shell.workspace} ${styles.workspace}`}>
      <div className={`${shell.topbar} ${styles.topbar}`}>
        <Link className={shell.upcomingEvent} href={nearest ? `/calendar?event=${encodeURIComponent(nearest.id)}` : "/calendar"}>
          <Icon name="calendar" size={22}/><span><strong>{nearest ? <>{nearest.title} <em>{nearest.allDay ? "Весь день" : nearest.startTime}</em></> : "Открыть календарь"}</strong><small>{training ? `След. тренировка ${training.startTime}` : "Планируйте тренировки и встречи"}</small></span><Icon name="arrow" size={16}/>
        </Link>
        <button className={shell.activityButton} onClick={() => setInfo("streak")} aria-label={`Серия: ${overview && today ? streakDays(overview, today) : 0} дней`}><Icon name="fire" size={19}/><strong>{overview && today ? streakDays(overview, today) : "—"}</strong></button>
        <button className={shell.notificationButton} onClick={() => setInfo("notifications")} aria-label={`Уведомления: ${unread} непрочитанных`}><Icon name="bell" size={22}/>{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</button>
      </div>
      <header className={styles.heading}><span className={styles.eyebrow}>Личный трекер состояния</span><h1>Настроение и энергия</h1><p>Отмечайте утро, день и вечер — так видно, как нагрузка и<br className={styles.desktopBreak}/> восстановление влияют на ваше состояние.</p></header>
      {ready ? <>
        <section className={styles.summary} aria-label="Сводка состояния">
          <article><span>За неделю</span><strong>{loggedDays.length}<small>/ 7</small></strong><p>дней с записями</p></article>
          <article><span>Слоты сегодня</span><strong>{todayCount}<small>/ 3</small></strong><p>заполнено за {fullDate.format(today)}</p></article>
          <article className={styles.accentSummary}><span><Icon name="smile" size={16}/> Настроение, неделя</span><strong>{averageMood?.toFixed(1) ?? "—"}</strong><p>{averageMood === null ? "Пока нет отметок" : averageMood >= 7 ? "Хороший настрой" : averageMood >= 5 ? "Стабильно" : "Низкое настроение"}</p></article>
          <article className={styles.accentSummary}><span><Icon name="energy" size={16}/> Энергия, неделя</span><strong>{averageEnergy?.toFixed(1) ?? "—"}</strong><p>{averageEnergy === null ? "Пока нет отметок" : averageEnergy >= 7 ? "Высокая энергия" : averageEnergy >= 5 ? "Ровный темп" : "Низкая энергия"}</p></article>
        </section>
        <section className={styles.panel} aria-labelledby="week-title">
          <header className={styles.weekHeader}><div><h2 id="week-title">Неделя наблюдений</h2><p>Среднее настроение и энергия за день, полоски — заполненные слоты</p></div><div className={styles.weekNavigation}><button onClick={() => changeWeek(-1)} aria-label="Предыдущая неделя"><Icon name="left" size={18}/></button><strong aria-live="polite">{rangeLabel(week, today)}</strong><button onClick={() => changeWeek(1)} disabled={week >= weekKey(today)} aria-label="Следующая неделя"><Icon name="right" size={18}/></button></div></header>
          <div className={styles.legend}>{daySlots.map(slot => <span key={slot}><i style={{ background: slotColors[slot] }}/>{slotLabels[slot]}</span>)}{week !== weekKey(today) && <button onClick={() => { setWeek(weekKey(today)); setSelected(todayKey); }}>К текущей неделе</button>}</div>
          <div className={styles.days} role="group" aria-label="Дни недели">
            {summaries.map((day, index) => <button key={day.date} id={`mood-day-${day.date}`} className={`${styles.day} ${selected === day.date ? styles.daySelected : ""}`} disabled={day.date > todayKey} aria-pressed={selected === day.date} aria-controls="day-records" aria-label={`${fullDate.format(parseDate(day.date))}: ${day.entries.length} из 3 отметок${day.date === todayKey ? ", сегодня" : ""}`} onClick={() => setSelected(day.date)} onKeyDown={event => {
              const nextIndex = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? Math.min(6, days.findLastIndex(date => date <= todayKey)) : -1;
              if (nextIndex < 0 || nextIndex > 6 || days[nextIndex] > todayKey) return;
              event.preventDefault(); setSelected(days[nextIndex]); document.getElementById(`mood-day-${days[nextIndex]}`)?.focus();
            }}>
              <span className={styles.dayTop}><span>{shortWeekday.format(parseDate(day.date))}</span>{day.date === todayKey && <em>Сегодня</em>}</span>
              <strong>{parseDate(day.date).getDate()}</strong>
              <span className={styles.dayScore}><Icon name="smile" size={14}/><b className={day.mood === null ? styles.missing : day.mood < 5 ? styles.low : day.mood >= 7 ? styles.high : ""}>{day.mood?.toFixed(1) ?? "—"}</b></span>
              <span className={styles.dayScore}><Icon name="energy" size={14}/><b className={day.energy === null ? styles.missing : day.energy < 5 ? styles.low : day.energy >= 7 ? styles.high : ""}>{day.energy?.toFixed(1) ?? "—"}</b></span>
              <span className={styles.slotIndicators}>{daySlots.map(slot => <i key={slot} style={{ background: day.entries.some(item => item.slot === slot) ? slotColors[slot] : undefined }}/>)}</span>
            </button>)}
          </div>
        </section>
        <section className={`${styles.panel} ${styles.records}`} id="day-records" aria-labelledby="records-title">
          <header className={styles.recordsHeader}><h2 id="records-title">Записи за {fullDate.format(parseDate(selected))}{selected === todayKey ? " · сегодня" : ""}</h2><p>{weekday.format(parseDate(selected))} · заполнено {selectedEntries.length} из 3 слотов</p></header>
          <div className={styles.slots} key={selected}>{daySlots.map(slot => <SlotCard key={slot} slot={slot} entry={selectedEntries.find(entry => entry.slot === slot)} onEdit={() => setEditing(slot)}/>)}</div>
        </section>
      </> : <div className={styles.loading} role="status">Загружаем ваши отметки…</div>}
    </section>
    {editing && store && <Modal title={`${slotLabels[editing]} · настроение и энергия`} onClose={() => setEditing(null)} wide><CheckInForm date={selected} slot={editing} initial={store.checkins.find(item => item.date === selected && item.slot === editing)} onSave={save}/></Modal>}
    {info && <Modal title={{ settings: "Личный трекер состояния", notifications: "Уведомления", streak: "Серия ежедневных оценок", plans: "Подписка Pro" }[info]} onClose={() => setInfo(null)}><div className={styles.infoBody}>
      {info === "notifications" ? calendar?.notifications.length ? calendar.notifications.map(item => <Link className={styles.notification} key={item.id} href={item.eventId ? `/calendar?event=${encodeURIComponent(item.eventId)}` : "/calendar"} onClick={() => { const next = { ...calendar, notifications: calendar.notifications.map(entry => entry.id === item.id ? { ...entry, read: true } : entry) }; setCalendar(next); writeStore(next); }}><span><strong>{item.title}</strong><small>{item.message}</small></span><Icon name="arrow" size={17}/></Link>) : <p>Новых уведомлений нет.</p> : info === "streak" ? <><strong className={styles.streak}>{overview && today ? streakDays(overview, today) : 0}</strong><p>Серия продолжается, когда в «Обзоре» заполнены все три ежедневные оценки. Здесь вы можете отмечать настроение и энергию, а качество сна — в «Обзоре».</p><Link className={shell.primaryButton} href="/overview">Открыть обзор</Link></> : info === "plans" ? <><h3>Трекер доступен без оплаты</h3><p>В демоверсии можно добавлять и редактировать отметки, смотреть недели и сохранять результаты без подписки.</p></> : <><h3>Три короткие отметки в день</h3><p>Оценивайте настроение и энергию от 1 до 10 утром, после основной нагрузки и перед сном. Средние значения за день обновляются в «Обзоре», а сами отметки видны в «Тестах».</p><p>Данные демоверсии хранятся только в этом браузере. Добавление и редактирование доступны для сегодняшних и прошедших дней.</p></>}
    </div></Modal>}
    {toast && <div className={shell.toast} role="status"><span><Icon name="check" size={17}/></span>{toast}</div>}
  </main>;
}
