"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CrmIcon as Icon, CrmModal as Modal, CrmSidebar } from "../components/crm-ui";
import { CalendarStore, readStore, STORAGE_KEY, writeStore } from "../calendar/calendar-data";
import { dateKey, dateOffset, mean, OVERVIEW_STORAGE_KEY, OverviewStore, parseDate, readOverviewStore, streakDays } from "../overview/overview-data";
import { calories, DayValue, duration, Meal, mergeOverviewSleep, Metric, metricDays, metricLabels, overviewWithSleep, Period, periodDates, readRecoveryStore, RECOVERY_STORAGE_KEY, RecoveryStore, sourceLabels, withMeal, withScreen, withSleep } from "./recovery-data";
import { Editing, RecordForm, SavedRecord, TargetForm } from "./recovery-forms";
import shell from "../calendar/calendar.module.css";
import styles from "./recovery.module.css";

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayDate = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const metricIcons = { sleep: "moon", screen: "phone", nutrition: "food" } as const;
const metricDescriptions: Record<Metric, string> = { sleep: "Кнопка на экране блокировки", screen: "Из системы телефона", nutrition: "По фото еды" };
const detailDescriptions: Record<Metric, string> = { sleep: "Длительность по ночам. Пропуски можно закрыть вручную", screen: "Экранное время по дням. Ручные записи можно изменить", nutrition: "Калории по дням. Добавляйте и редактируйте приёмы пищи" };
const valueLabel = (metric: Metric, value: number) => metric === "nutrition" ? `${calories(value)} ккал` : duration(value);
const dateLabel = (date: string, today: string) => date === today ? "Сегодня" : date === dateKey(dateOffset(parseDate(today), -1)) ? "Вчера" : weekdayDate.format(parseDate(date)).replace(/\./g, "");

function MiniChart({ days }: { days: DayValue[] }) {
  const maximum = Math.max(...days.map(day => day.value ?? 0), 1);
  return <div className={styles.miniChart} aria-hidden="true">{days.map(day => <i key={day.date} className={day.value === null ? styles.missingMini : day.source === "manual" ? styles.manualMini : ""} style={{ height: day.value === null ? "100%" : `${Math.max(8, (day.value / maximum) * 85)}%` }}/>)}</div>;
}

function RecoveryChart({ days, metric, target, onOpen }: { days: DayValue[]; metric: Metric; target: number; onOpen: (date: string) => void }) {
  const [hovered, setHovered] = useState<DayValue | null>(null);
  const step = metric === "nutrition" ? 500 : 120;
  const maximum = Math.max(metric === "nutrition" ? 3000 : 600, Math.ceil(Math.max(target, ...days.map(day => day.value ?? 0)) / step) * step);
  const axisLabel = (value: number) => metric === "nutrition" ? calories(value) : `${Number((value / 60).toFixed(1))} ч`;
  return <div className={styles.chartScroll}>
    <div className={styles.chart} role="group" aria-label={`${metricLabels[metric]} по дням`}>
      <div className={styles.axis}><span>{axisLabel(maximum)}</span><span>{axisLabel(maximum / 2)}</span><span>0</span></div>
      <div className={styles.plot}>
        <div className={styles.gridLines} aria-hidden="true"><i/><i/><i/></div>
        <div className={styles.targetLine} style={{ bottom: `${target / maximum * 100}%` }} aria-hidden="true"/>
        <div className={styles.chartBars} style={days.length > 14 ? { gap: 8 } : undefined}>{days.map((day, index) => <button key={day.date} className={styles.chartColumn} aria-label={`${fullDate.format(parseDate(day.date))}: ${day.value === null ? "нет данных, внести" : `${valueLabel(metric, day.value)}, ${sourceLabels[day.source!]}`}`} title={`${fullDate.format(parseDate(day.date))}: ${day.value === null ? "нет данных" : valueLabel(metric, day.value)}`} onClick={() => onOpen(day.date)} onMouseEnter={() => setHovered(day)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(day)} onBlur={() => setHovered(null)}>
          <span className={`${styles.bar} ${day.value === null ? styles.missingBar : day.source === "manual" ? styles.manualBar : ""}`} style={{ height: day.value === null ? "100%" : `${Math.max(1, day.value / maximum * 100)}%` }}/>
          <small>{index === 0 || index === days.length - 1 || index % Math.ceil(days.length / 5) === 0 ? shortDate.format(parseDate(day.date)).replace(/\./g, "") : ""}</small>
        </button>)}</div>
        {hovered && <div className={styles.chartTooltip}><strong>{fullDate.format(parseDate(hovered.date))}</strong><span>{hovered.value === null ? "Нет данных · нажмите, чтобы внести" : `${valueLabel(metric, hovered.value)} · ${sourceLabels[hovered.source!]}`}</span></div>}
      </div>
    </div>
  </div>;
}

export default function RecoveryApp() {
  const router = useRouter();
  const [today, setToday] = useState<Date | null>(null);
  const [store, setStore] = useState<RecoveryStore | null>(null);
  const [overview, setOverview] = useState<OverviewStore | null>(null);
  const [calendar, setCalendar] = useState<CalendarStore | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [mealDay, setMealDay] = useState<string | null>(null);
  const [info, setInfo] = useState<"phone" | "notifications" | "streak" | "settings" | "plans" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const ready = !!today && !!store && !!overview && !!calendar;

  useEffect(() => {
    const load = () => {
      const now = new Date(), dashboard = readOverviewStore(now);
      setToday(now); setOverview(dashboard); setStore(mergeOverviewSleep(readRecoveryStore(now), dashboard)); setCalendar(readStore());
    };
    const frame = requestAnimationFrame(load);
    const sync = (event: StorageEvent) => { if ([RECOVERY_STORAGE_KEY, OVERVIEW_STORAGE_KEY, STORAGE_KEY, null].includes(event.key)) load(); };
    window.addEventListener("storage", sync); window.addEventListener("focus", load);
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); window.removeEventListener("storage", sync); window.removeEventListener("focus", load); };
  }, []);
  useEffect(() => {
    if (!store) return;
    try { localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(store)); }
    catch { const timer = setTimeout(() => setToast("Изменения видны на странице, но не сохранятся после закрытия. Проверьте память браузера."), 0); return () => clearTimeout(timer); }
  }, [store]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4200); return () => clearTimeout(timer); }, [toast]);

  const todayKey = today ? dateKey(today) : "";
  const dates = today && store ? periodDates(today, store.period) : [];
  const allDays = store ? { sleep: metricDays(store, "sleep", dates), screen: metricDays(store, "screen", dates), nutrition: metricDays(store, "nutrition", dates) } : null;
  const selectedDays = store && allDays ? allDays[store.metric] : [];
  const role = calendar?.role ?? "player";
  const unread = calendar?.notifications.filter(item => !item.read).length ?? 0;
  const switchRole = () => { const next = { ...(calendar ?? readStore()), role: role === "player" ? "manager" as const : "player" as const }; setCalendar(next); writeStore(next); };
  const showDetails = (metric: Metric) => {
    setStore(current => current ? { ...current, metric } : current);
    detailsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  };
  const openDay = (metric: Metric, date: string) => metric === "nutrition" && store?.meals.some(meal => meal.date === date) ? setMealDay(date) : setEditing({ metric, date });
  const saveRecord = (value: SavedRecord) => {
    if (!store || !today || value.entry.date > dateKey(new Date())) return;
    const next = value.metric === "sleep" ? withSleep(store, value.entry) : value.metric === "screen" ? withScreen(store, value.entry) : withMeal(store, value.entry);
    setStore(next); setEditing(null);
    // Publish the detailed record before its Overview projection so other tabs
    // cannot mistake our own duration update for an edit without bed/wake times.
    let recoverySaved = true;
    try { localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(next)); } catch { recoverySaved = false; }
    let overviewSaved = true;
    if (value.metric === "sleep") {
      const dashboard = overviewWithSleep(readOverviewStore(today), value.entry); setOverview(dashboard);
      try { localStorage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(dashboard)); } catch { overviewSaved = false; }
    }
    setToast(!recoverySaved ? "Запись добавлена, но не сохранится после закрытия страницы. Проверьте память браузера." : !overviewSaved ? "Запись добавлена. Не удалось обновить обзор в памяти браузера." : value.metric === "sleep" ? "Запись сна сохранена. Обзор обновлён." : "Запись сохранена");
  };
  const editMeal = (meal: Meal) => { setMealDay(null); setEditing({ metric: "nutrition", date: meal.date, mealId: meal.id }); };

  return <main className={`${shell.app} ${styles.app}`} aria-busy={!ready}>
    <header className={shell.mobileHeader}><div className={shell.brandMark}><Icon name="logo" size={25}/></div><strong>Performance CRM</strong><button className={shell.iconButton} onClick={() => setMobileMenu(value => !value)} aria-label={mobileMenu ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileMenu}><Icon name={mobileMenu ? "close" : "menu"}/></button></header>
    {mobileMenu && <button className={shell.menuBackdrop} onClick={() => setMobileMenu(false)} aria-label="Закрыть меню"/>}
    <CrmSidebar active="recovery" role={role} mobileOpen={mobileMenu} onClose={() => setMobileMenu(false)} onSwitchRole={switchRole} onSettings={() => setInfo("settings")} onSection={name => name === "plans" ? setInfo("plans") : router.push(`/overview?section=${name}`)}/>
    <section className={`${shell.workspace} ${styles.workspace}`}>
      <div className={styles.topbar}><button className={shell.activityButton} onClick={() => setInfo("streak")} aria-label={`Серия: ${overview && today ? streakDays(overview, today) : 0} дней`}><Icon name="fire" size={18}/><strong>{overview && today ? streakDays(overview, today) : "—"}</strong></button><button className={shell.notificationButton} onClick={() => setInfo("notifications")} aria-label={`Уведомления: ${unread} непрочитанных`}><Icon name="bell" size={22}/>{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</button></div>
      <header className={styles.pageHeader}><div className={styles.heading}><span className={styles.eyebrow}>Сон · Экранное время · Питание</span><h1>Восстановление</h1><p>Данные приходят из мобильного приложения сами: сон — кнопкой на<br className={styles.desktopBreak}/> экране блокировки, экранное время — из системы, питание — по фото еды.</p></div><div className={styles.headerControls}><button className={styles.phoneStatus} onClick={() => setInfo("phone")}><Icon name="phone" size={15}/><strong>Телефон подключён</strong><span>· демо {store?.syncedAt.slice(11, 16) ?? "19:55"}</span></button><div className={styles.periods} role="group" aria-label="Период восстановления">{([7, 14, 30] as Period[]).map(period => <button key={period} aria-pressed={store?.period === period} className={store?.period === period ? styles.periodActive : ""} onClick={() => setStore(current => current ? { ...current, period } : current)}>{period} дней</button>)}</div></div></header>
      {ready && allDays ? <>
        <section className={styles.metrics} aria-label="Показатели восстановления">
          {(["sleep", "screen", "nutrition"] as Metric[]).map(metric => {
            const days = allDays[metric], valid = days.filter(day => day.value !== null), average = valid.length ? mean(valid.map(day => day.value!)) : null;
            const current = days.at(-1)!;
            const badge = current.value === null ? "Нет данных" : metric === "sleep" ? current.value >= store.targets.sleep - 60 ? "Норма" : "Ниже цели" : current.value > store.targets[metric] ? "Выше цели" : "В пределах";
            return <article key={metric} className={`${styles.metricCard} ${store.metric === metric ? styles.selectedCard : ""}`}>
              <header><span className={styles.metricIcon}><Icon name={metricIcons[metric]} size={24}/></span><div><h2>{metricLabels[metric]}</h2><p>{metricDescriptions[metric]}</p></div><span className={`${styles.badge} ${badge === "Выше цели" || badge === "Ниже цели" ? styles.warningBadge : ""}`}>{badge}</span></header>
              <span className={styles.metricCaption}>{metric === "sleep" ? "Прошлая ночь" : "Сегодня"}{metric === "nutrition" ? ` · ${current.count} приёма пищи` : ""}</span>
              <strong className={styles.metricValue}>{current.value === null ? "—" : valueLabel(metric, current.value)}</strong>
              <p className={styles.metricAverage}>{metric === "nutrition" ? `Цель ${calories(store.targets.nutrition)} · ` : ""}{average === null ? "Пока нет записей" : `В среднем ${valueLabel(metric, average)}${metric === "sleep" ? ` за ${store.period} дней · пропусков: ${days.length - valid.length}` : metric === "screen" ? " в день" : ""}`}</p>
              {metric === "nutrition" && <div className={styles.foodProgress} role="meter" aria-label="Калории сегодня" aria-valuemin={0} aria-valuemax={Math.max(store.targets.nutrition, current.value ?? 0)} aria-valuenow={current.value ?? 0}><i style={{ width: `${Math.min(100, (current.value ?? 0) / store.targets.nutrition * 100)}%` }}/></div>}
              <MiniChart days={days}/>
              <div className={styles.cardActions}><button className={styles.detailsButton} onClick={() => showDetails(metric)}>Подробнее <Icon name="chevron" size={12}/></button><button className={styles.addButton} onClick={() => setEditing({ metric, date: todayKey, adding: true })} aria-label={`Внести вручную: ${metricLabels[metric]}`}><Icon name="plus" size={13}/> Внести вручную</button></div>
            </article>;
          })}
        </section>
        <section ref={detailsRef} className={styles.details} aria-labelledby="detail-title">
          <header className={styles.detailHeader}><div><h2 id="detail-title">{metricLabels[store.metric]}</h2><p>{detailDescriptions[store.metric]}</p></div><div className={styles.metricTabs} role="tablist" aria-label="Показатель восстановления">{(["sleep", "screen", "nutrition"] as Metric[]).map((metric, index) => <button key={metric} role="tab" id={`recovery-tab-${metric}`} aria-controls="recovery-detail" aria-selected={store.metric === metric} tabIndex={store.metric === metric ? 0 : -1} className={store.metric === metric ? styles.tabActive : ""} onClick={() => setStore(current => current ? { ...current, metric } : current)} onKeyDown={event => { const keys: Metric[] = ["sleep", "screen", "nutrition"]; const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1; if (next < 0) return; event.preventDefault(); setStore(current => current ? { ...current, metric: keys[next] } : current); document.getElementById(`recovery-tab-${keys[next]}`)?.focus(); }}>{metricLabels[metric]}</button>)}</div></header>
          <div id="recovery-detail" role="tabpanel" aria-labelledby={`recovery-tab-${store.metric}`}>
            <RecoveryChart key={`${store.metric}-${store.period}`} days={selectedDays} metric={store.metric} target={store.targets[store.metric]} onOpen={date => openDay(store.metric, date)}/>
            <div className={styles.legend}><span><i/>{store.metric === "nutrition" ? "По фото еды" : "С телефона"}</span><span><i className={styles.manualLegend}/>Внесено вручную</span><span><i className={styles.missingLegend}/>Нет данных</span><button onClick={() => setInfo("settings")}><i className={styles.targetLegend}/>Ориентир — {valueLabel(store.metric, store.targets[store.metric])}</button></div>
            <div className={styles.tableScroll}><table className={styles.historyTable}><thead><tr><th>{store.metric === "sleep" ? "Ночь" : "День"}</th>{store.metric === "sleep" ? <><th>Отход ко сну</th><th>Подъём</th><th>Длительность</th></> : store.metric === "screen" ? <><th>Экранное время</th><th>Ориентир</th><th>Разница</th></> : <><th>Приёмы пищи</th><th>Калории</th><th>Ориентир</th></>}<th>Источник</th></tr></thead><tbody>{[...selectedDays].reverse().map(day => {
              const sleep = store.sleep.find(entry => entry.date === day.date);
              return <tr key={day.date} className={day.value === null ? styles.missingRow : ""}><td>{dateLabel(day.date, todayKey)}</td>{store.metric === "sleep" ? <><td>{sleep?.bedTime ?? "—"}</td><td>{sleep?.wakeTime ?? "—"}</td><td><strong>{day.value === null ? "—" : duration(day.value)}</strong></td></> : store.metric === "screen" ? <><td><strong>{day.value === null ? "—" : duration(day.value)}</strong></td><td>{duration(store.targets.screen)}</td><td className={day.value !== null && day.value > store.targets.screen ? styles.overTarget : ""}>{day.value === null ? "—" : `${day.value > store.targets.screen ? "+" : day.value < store.targets.screen ? "−" : ""}${duration(Math.abs(day.value - store.targets.screen))}`}</td></> : <><td>{day.count || "—"}</td><td><strong>{day.value === null ? "—" : `${calories(day.value)} ккал`}</strong></td><td>{calories(store.targets.nutrition)} ккал</td></>}<td><button className={`${styles.sourceBadge} ${day.source === "manual" ? styles.manualSource : ""} ${day.value === null ? styles.emptySource : ""}`} onClick={() => openDay(store.metric, day.date)} aria-label={`${day.value === null ? "Добавить" : store.metric === "nutrition" ? "Открыть" : "Изменить"} ${metricLabels[store.metric].toLowerCase()}: ${fullDate.format(parseDate(day.date))}`}>{day.source ? sourceLabels[day.source] : "Нет данных · внести"}</button></td></tr>;
            })}</tbody></table></div>
          </div>
        </section>
      </> : <p className={styles.loading} role="status">Загружаем данные восстановления…</p>}
    </section>
    {editing && store && <Modal title={`${metricLabels[editing.metric]} · ручная запись`} wide onClose={() => setEditing(null)}><RecordForm editing={editing} store={store} today={todayKey} onSave={saveRecord}/></Modal>}
    {mealDay && store && <Modal title={`Питание за ${fullDate.format(parseDate(mealDay))}`} onClose={() => setMealDay(null)}><div className={styles.formBody}><div className={styles.mealList}>{store.meals.filter(meal => meal.date === mealDay).sort((a, b) => a.time.localeCompare(b.time)).map(meal => <article key={meal.id}><div><strong>{meal.name}</strong><small>{meal.time} · {sourceLabels[meal.source]}</small>{meal.note && <p>{meal.note}</p>}</div><strong>{calories(meal.calories)} ккал</strong><button className={shell.iconButton} onClick={() => editMeal(meal)} aria-label={`Изменить: ${meal.name}`}><Icon name="edit" size={16}/></button></article>)}</div><button className={shell.primaryButton} onClick={() => { setEditing({ metric: "nutrition", date: mealDay, adding: true }); setMealDay(null); }}><Icon name="plus" size={16}/> Добавить приём пищи</button></div></Modal>}
    {info && <Modal title={{ phone: "Подключение телефона", notifications: "Уведомления", streak: "Серия ежедневных оценок", settings: "Ориентиры восстановления", plans: "Подписка Pro" }[info]} onClose={() => setInfo(null)}>
      {info === "settings" && store ? <TargetForm initial={store.targets} onSave={targets => { setStore(current => current ? { ...current, targets } : current); setInfo(null); setToast("Ориентиры обновлены"); }}/> : <div className={styles.formBody}>{info === "phone" ? <><h3>Демонстрационные данные</h3><p className={styles.formIntro}>Статус подключения и данные с телефона показаны для примера. Автоматическая синхронизация сна, экранного времени и фотографий еды ещё не подключена.</p><p className={styles.formIntro}>Сейчас можно вносить записи вручную. Они сохраняются только в этом браузере. Для синхронизации между устройствами потребуется мобильное приложение и бэкенд.</p></> : info === "notifications" ? calendar?.notifications.length ? calendar.notifications.map(item => <Link className={styles.notification} key={item.id} href={item.eventId ? `/calendar?event=${encodeURIComponent(item.eventId)}` : "/calendar"} onClick={() => { const next = { ...calendar, notifications: calendar.notifications.map(entry => entry.id === item.id ? { ...entry, read: true } : entry) }; setCalendar(next); writeStore(next); }}><strong>{item.title}</strong><small>{item.message}</small></Link>) : <p className={styles.formIntro}>Новых уведомлений нет.</p> : info === "streak" ? <><strong className={styles.streak}>{overview && today ? streakDays(overview, today) : 0}</strong><p className={styles.formIntro}>Заполняйте в «Обзоре» настроение, энергию и качество сна, чтобы продолжать ежедневную серию.</p><Link className={shell.primaryButton} href="/overview">Открыть обзор</Link></> : <><h3>Восстановление доступно без оплаты</h3><p className={styles.formIntro}>В демоверсии доступны все периоды, ручные записи и настройка личных ориентиров.</p></>}</div>}
    </Modal>}
    {toast && <div className={shell.toast} role="status"><span><Icon name="check" size={17}/></span>{toast}</div>}
  </main>;
}
