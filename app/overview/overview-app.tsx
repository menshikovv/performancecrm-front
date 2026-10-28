"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useLayoutEffect, useMemo, useState } from "react";
import { CrmIcon as Icon, CrmModal as Modal, CrmSidebar } from "../components/crm-ui";
import { CalendarStore, readStore, writeStore } from "../calendar/calendar-data";
import shell from "../calendar/calendar.module.css";
import styles from "./overview.module.css";
import StaffOverview from "./staff-overview";
import { CheckKey, MetricKey, OverviewStore, OVERVIEW_STORAGE_KEY, Sample, WidgetGroup, checkLabels, createOverviewStore, dateKey, formatHours, groupLabels, mean, metricLabels, metricSamples, parseDate, readOverviewStore, saveCheck, scoreStatus, streakDays, visibleSamples, weekDates } from "./overview-data";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const plural = new Intl.PluralRules("ru-RU");
function recordCount(value: number) { return `${value} ${{ one: "запись", few: "записи", many: "записей", other: "записи", two: "записи", zero: "записей" }[plural.select(value)]}`; }
function lastValue(samples: Sample[]) { return [...samples].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.value ?? 0; }
const bucketInfo = [
  { label: "Отличное", range: "8–10", color: "#38cdf3", accepts: (value: number) => value >= 8 },
  { label: "Хорошее", range: "6–7", color: "#246aff", accepts: (value: number) => value >= 6 && value < 8 },
  { label: "Среднее", range: "4–5", color: "#7c8caf", accepts: (value: number) => value >= 4 && value < 6 },
  { label: "Плохое", range: "0–3", color: "#ff893e", accepts: (value: number) => value < 4 },
];

function Badge({ value, label }: { value: number; label?: string }) {
  const status = scoreStatus(value);
  return <span className={`${styles.badge} ${styles[status.tone]}`}><i />{label ?? status.label}</span>;
}
function CardHeader({ title, subtitle, value, onExpand }: { title: string; subtitle: string; value: number; onExpand: () => void }) {
  return <header className={styles.cardHeader}><div><h3>{title}</h3><p>{subtitle}</p></div><Badge value={value} /><button className={styles.expandButton} onClick={onExpand} aria-label={`Подробнее: ${title}`} title="Открыть статистику"><Icon name="arrow" size={17} /></button></header>;
}

function MoodDonut({ samples }: { samples: Sample[] }) {
  const average = mean(samples.map(item => item.value));
  const circumference = 2 * Math.PI * 85;
  const segments = bucketInfo.map((bucket, index) => {
    const count = samples.filter(item => bucket.accepts(item.value)).length;
    const length = samples.length ? count / samples.length * circumference : 0;
    const previousCount = bucketInfo.slice(0, index).reduce((total, previous) => total + samples.filter(item => previous.accepts(item.value)).length, 0);
    return { ...bucket, count, length, offset: samples.length ? previousCount / samples.length * circumference : 0 };
  });
  return <><div className={styles.donutWrap}><svg viewBox="0 0 240 240" className={styles.donut} role="img" aria-label={`Среднее настроение ${average.toFixed(1)} из 10; ${recordCount(samples.length)}`}><circle cx="120" cy="120" r="85" fill="none" stroke="#202b44" strokeWidth="18" />{segments.filter(item => item.length > 0).map(item => <circle key={item.label} cx="120" cy="120" r="85" fill="none" stroke={item.color} strokeWidth="18" strokeLinecap="round" strokeDasharray={`${Math.max(0, item.length - 9)} ${circumference}`} strokeDashoffset={-item.offset} transform="rotate(-90 120 120)" className={styles.donutSegment} />)}<text x="120" y="123" textAnchor="middle" className={styles.donutValue}>{samples.length ? average.toFixed(1) : "—"}</text><text x="120" y="148" textAnchor="middle" className={styles.donutCaption}>среднее значение</text></svg></div><div className={styles.breakdown}><h4>По категориям</h4>{segments.map(item => <div key={item.label} className={styles.categoryRow}><i style={{ background: item.color }} /><div><strong>{item.label}</strong><small>{item.range}</small></div><div><strong>{samples.length ? Math.round(item.count / samples.length * 100) : 0}%</strong><small>{recordCount(item.count)}</small></div></div>)}</div></>;
}

function SleepChart({ store, days }: { store: OverviewStore; days: string[] }) {
  const id = useId().replaceAll(":", "");
  const [active, setActive] = useState<number | null>(null);
  const values = days.map(date => store.sleep.find(item => item.date === date));
  const x = (index: number) => 58 + index * 58;
  const y = (value: number) => 145 - value * 11.2;
  const line = values.map((item, index) => `${index ? "L" : "M"}${x(index)},${y(item?.energy ?? 0)}`).join(" ");
  return <div className={styles.sleepChartArea}><div className={styles.chartLegend}><span><i />Сон, ч</span><span><i />Энергия, 0–10</span></div><div className={styles.sleepChart}><svg viewBox="0 0 450 190" role="img" aria-label="Сон в часах и энергия по дням недели"><defs><linearGradient id={`sleep-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00bde7"/><stop offset="100%" stopColor="#0060ec"/></linearGradient></defs>{[0, 5, 10].map(value => <g key={value}><line x1="24" x2="438" y1={y(value)} y2={y(value)} stroke="#202a41"/><text x="12" y={y(value) + 3} textAnchor="end" className={styles.axisLabel}>{value}</text></g>)}{values.map((item, index) => <g key={days[index]} onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)}><rect x={x(index) - 15} y={y(item?.hours ?? 0)} width="30" height={Math.max(0, 145 - y(item?.hours ?? 0))} rx="5" fill={`url(#sleep-${id})`} opacity={active === null || active === index ? 1 : .65}/><rect x={x(index) - 25} y="10" width="50" height="140" fill="transparent"/><text x={x(index)} y="164" textAnchor="middle" className={styles.axisLabel}>{weekdayFormatter.format(parseDate(days[index]))}</text></g>)}<path d={line} fill="none" stroke="#ffba39" strokeWidth="2" pointerEvents="none"/>{values.map((item, index) => <circle key={days[index]} cx={x(index)} cy={y(item?.energy ?? 0)} r="3.3" fill="#10182a" stroke="#ffba39" strokeWidth="1.5" pointerEvents="none" />)}</svg>{active !== null && <div className={styles.chartTooltip} role="status">{dateFormatter.format(parseDate(days[active]))} · {formatHours(values[active]?.hours ?? 0)} · энергия {values[active]?.energy ?? 0}</div>}</div></div>;
}

function TrendChart({ values, orange = false, label }: { values: number[]; orange?: boolean; label: string }) {
  const id = useId().replaceAll(":", "");
  const points = values.map((value, index) => [8 + index * 424 / Math.max(1, values.length - 1), 116 - value * 10]);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
  const color = orange ? "#ff8a43" : "#00baff";
  return <svg className={styles.trendChart} viewBox="0 0 440 135" role="img" aria-label={label}><defs><linearGradient id={`trend-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".35"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>{points.length > 0 && <><path d={`${line} L${points.at(-1)![0]},130 L8,130 Z`} fill={`url(#trend-${id})`}/><path d={line} fill="none" stroke={color} strokeWidth="2"/>{points.length > 1 && <circle cx={points.at(-1)![0]} cy={points.at(-1)![1]} r="4" fill={color}/>}</>}</svg>;
}

function RecordForm({ metric, today, onSave, onCancel }: { metric: MetricKey; today: string; onSave: (date: string, value: number, energy: number, note: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(today);
  const [value, setValue] = useState(metric === "sleep" ? "7.5" : "7");
  const [energy, setEnergy] = useState("6");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const number = Number(value); const energyNumber = Number(energy);
    if (!date || date > today || dateKey(parseDate(date)) !== date) { setError("Выберите сегодняшнюю или прошедшую дату"); return; }
    if (!value.trim() || !Number.isFinite(number) || number < 0 || number > (metric === "sleep" ? 24 : 10) || (metric === "sleep" && (!energy.trim() || !Number.isFinite(energyNumber) || energyNumber < 0 || energyNumber > 10))) { setError(metric === "sleep" ? "Укажите сон от 0 до 24 часов и энергию от 0 до 10" : "Укажите значение от 0 до 10"); return; }
    onSave(date, number, energyNumber, note.trim());
  };
  return <form className={styles.recordForm} onSubmit={submit} noValidate><h3>Новая запись</h3><div className={shell.formGrid}><label className={shell.field}><span>Дата</span><input aria-label="Дата записи" type="date" max={today} value={date} onChange={event => setDate(event.target.value)} required /></label><label className={shell.field}><span>{metric === "sleep" ? "Продолжительность сна, ч" : "Оценка, 0–10"}</span><input aria-label="Значение записи" type="number" min="0" max={metric === "sleep" ? 24 : 10} step="0.1" value={value} onChange={event => setValue(event.target.value)} required /></label></div>{metric === "sleep" && <label className={shell.field}><span>Энергия, 0–10</span><input aria-label="Энергия за день" type="number" min="0" max="10" step="0.1" value={energy} onChange={event => setEnergy(event.target.value)} required /></label>}<label className={shell.field}><span>Заметка</span><textarea aria-label="Заметка к записи" rows={2} maxLength={300} value={note} onChange={event => setNote(event.target.value)} placeholder="Что повлияло на результат?" /></label>{error && <p className={styles.formError} role="alert">{error}</p>}<div className={styles.recordActions}><button type="button" className={shell.secondaryButton} onClick={onCancel}>Отмена</button><button className={shell.primaryButton} type="submit">Сохранить запись</button></div></form>;
}

export default function OverviewApp() {
  const [store, setStore] = useState<OverviewStore>(() => createOverviewStore());
  const [today, setToday] = useState(() => new Date());
  const [calendar, setCalendar] = useState<CalendarStore | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [detail, setDetail] = useState<MetricKey | null>(null);
  const [addingRecord, setAddingRecord] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useLayoutEffect(() => {
    const load = () => { const now = new Date(); setToday(now); setStore(readOverviewStore(now)); setCalendar(readStore()); setHydrated(true); };
    load();
    const previewRole = new URLSearchParams(location.search).get("role");
    if (previewRole === "staff" || previewRole === "player") { const next = { ...readStore(), role: previewRole === "staff" ? "manager" as const : "player" as const }; setCalendar(next); writeStore(next); }
    const section = new URLSearchParams(location.search).get("section");
    if (section === "mood" || section === "recovery" || section === "game") setDetail(section);
    const frame = requestAnimationFrame(() => {
      if (section === "stats") document.getElementById("weekly-review")?.scrollIntoView();
      if (section === "tests") document.getElementById("daily-tests")?.scrollIntoView();
    });
    if (section === "plans") setToast("В демоверсии все виджеты доступны без подписки");
    const sync = (event: StorageEvent) => { if (event.key === OVERVIEW_STORAGE_KEY || event.key === "calendar-app:v1" || event.key === null) load(); };
    const onFocus = () => { setToday(new Date()); };
    window.addEventListener("storage", sync); window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); window.removeEventListener("storage", sync); window.removeEventListener("focus", onFocus); };
  }, []);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(store)); } catch { setTimeout(() => setToast("Не удалось сохранить изменения. Проверьте свободное место в браузере."), 0); } }, [store, hydrated]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3800); return () => clearTimeout(timer); }, [toast]);

  const todayKey = dateKey(today);
  const days = useMemo(() => weekDates(today), [today]);
  const checks = store.daily[todayKey] ?? {};
  const completed = Object.keys(checks).length;
  const streak = streakDays(store, today);
  const mood = visibleSamples(store.mood, days);
  const nights = days.flatMap(date => store.sleep.filter(item => item.date === date));
  const loggedNights = nights.filter(item => item.sleepLogged !== false);
  const averageSleep = mean(loggedNights.map(item => item.hours));
  const todayEnergy = store.sleep.find(item => item.date === todayKey)?.energy;
  const previousEnergy = store.sleep.find(item => item.date === days[5])?.energy ?? 0;
  const peakDay = [...nights].sort((a, b) => b.energy - a.energy)[0];
  const role = calendar?.role ?? "player";
  const upcoming = [...(calendar?.events ?? [])].filter(event => event.ownerId === "personal" && new Date(`${event.date}T${event.allDay ? "23:59" : event.startTime}`).getTime() >= today.getTime()).sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  const nearest = upcoming[0];
  const training = upcoming.find(event => event.type === "practice" || event.type === "training");
  const unread = calendar?.notifications.filter(item => !item.read).length ?? 0;
  const openDetail = (metric: MetricKey) => { setDetail(metric); setAddingRecord(false); };
  const toggleGroup = (group: WidgetGroup) => setStore(current => ({ ...current, widgets: current.widgets.includes(group) ? current.widgets.filter(item => item !== group) : [...current.widgets, group] }));
  const onSection = (section: string) => {
    if (section === "tests" || section === "stats") { document.getElementById(section === "tests" ? "daily-tests" : "weekly-review")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (section === "mood" || section === "recovery" || section === "game") openDetail(section);
    else setToast("В демоверсии все виджеты доступны без подписки");
  };
  const switchRole = () => { const next = { ...(calendar ?? readStore()), role: role === "player" ? "manager" as const : "player" as const }; setCalendar(next); writeStore(next); setToast(next.role === "manager" ? "Включён режим менеджера" : "Включён режим игрока"); };
  const addRecord = (date: string, value: number, energy: number, note: string) => {
    if (!detail) return;
    setStore(current => {
      if (detail === "sleep") return { ...current, sleep: [...current.sleep.filter(item => item.date !== date), { date, hours: value, energy, note }] };
      const sample: Sample = { id: `manual-${detail}-${date}`, date, value, note };
      if (detail === "mood") return { ...current, mood: [...current.mood.filter(item => item.id !== sample.id), sample] };
      return { ...current, metrics: { ...current.metrics, [detail]: [...current.metrics[detail].filter(item => item.id !== sample.id), sample] } };
    });
    setAddingRecord(false); setToast("Запись сохранена");
  };
  const detailSamples = detail ? [...metricSamples(store, detail)].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const trendCard = (metric: Exclude<MetricKey, "mood" | "sleep">) => {
    const samples = visibleSamples(store.metrics[metric], days);
    const values = days.map(date => mean(samples.filter(item => item.date === date).map(item => item.value)));
    const current = lastValue(samples); const difference = current - (samples[0]?.value ?? current);
    return <article key={metric} className={styles.metricCard} data-widget={metric}><CardHeader title={metricLabels[metric]} subtitle="7 дней" value={current} onExpand={() => openDetail(metric)} /><div className={styles.metricValue}><strong>{samples.length ? current.toFixed(1) : "—"}</strong><span className={difference < 0 ? styles.orangeText : styles.cyanText}>{difference >= 0 ? "↑" : "↓"} {Math.abs(difference).toFixed(1)} за неделю</span></div><div className={styles.trendWrap}><TrendChart values={values} orange={difference < 0} label={`${metricLabels[metric]} за неделю: ${values.map(value => value.toFixed(1)).join(", ")}`} /></div></article>;
  };

  if (!hydrated) return <main className={`${shell.app} ${styles.app}`} aria-busy="true"><section className={shell.workspace}><p role="status">Загрузка обзора…</p></section></main>;

  if (role === "manager") return <StaffOverview calendar={calendar} today={today} onSwitchRole={() => { const url = new URL(window.location.href); url.searchParams.delete("role"); window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`); switchRole(); }} />;

  return <main className={`${shell.app} ${styles.app}`} aria-busy={!hydrated}>
    <header className={shell.mobileHeader}><div className={shell.brandMark}><Icon name="logo" size={25} /></div><strong>Performance CRM</strong><button className={shell.iconButton} onClick={() => setMobileMenu(value => !value)} aria-label={mobileMenu ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileMenu}><Icon name={mobileMenu ? "close" : "menu"} /></button></header>
    {mobileMenu && <button className={shell.menuBackdrop} onClick={() => setMobileMenu(false)} aria-label="Закрыть меню" />}
    <CrmSidebar active="overview" role={role} mobileOpen={mobileMenu} onClose={() => setMobileMenu(false)} onSwitchRole={switchRole} onSettings={() => setSettingsOpen(true)} onSection={onSection} />
    <section className={`${shell.workspace} ${styles.workspace}`}>
      <div className={styles.pageHeader}><h1>Обзор</h1><div className={`${shell.topbar} ${styles.topbar}`}><Link className={shell.upcomingEvent} href={nearest ? `/calendar?event=${encodeURIComponent(nearest.id)}` : "/calendar"} aria-label="Открыть ближайшее событие в календаре"><Icon name="calendar" size={22} /><span><strong>{nearest?.title ?? "Ваш календарь"} {nearest && <em>{nearest.allDay ? "Весь день" : nearest.startTime}</em>}</strong><small>{training ? `След. тренировка ${training.startTime}` : "Тренировки и события команды"}</small></span><Icon name="arrow" size={17} /></Link><button className={shell.activityButton} aria-label={`Серия ежедневных тестов: ${streak} дней`} onClick={() => setToast(`Серия: ${streak} дней. Заполняйте все три оценки каждый день.`)}><Icon name="fire" size={21} /><strong>{streak}</strong></button><button className={shell.notificationButton} onClick={() => setNotificationsOpen(true)} aria-label={`Уведомления: ${unread} непрочитанных`}><Icon name="bell" size={22} />{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</button></div></div>

      <section className={styles.dailyPanel} id="daily-tests" aria-labelledby="daily-title"><div className={styles.dailyHeader}><div className={styles.dailyFlame}><Icon name={completed === 3 ? "check" : "fire"} size={24} /></div><div><h2 id="daily-title">Ежедневные тесты</h2><p aria-live="polite">{completed === 3 ? "Готово! Все оценки на сегодня сохранены." : `Три клика — и серия продолжится. Осталось: ${3 - completed}`}</p></div><div className={styles.progress}><div role="progressbar" aria-label="Ежедневные тесты" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={3}><i style={{ width: `${completed / 3 * 100}%` }} /></div><strong>{completed} / 3</strong></div></div><div className={styles.dailyGrid}>{(Object.keys(checkLabels) as CheckKey[]).map(key => <fieldset key={key} className={`${styles.ratingCard} ${checks[key] ? styles.ratingComplete : ""}`}><legend>{checkLabels[key]}</legend><div className={styles.ratingHeading}><strong>{checkLabels[key]}</strong><span>{key === "energy" ? "1 — нет сил · 5 — заряжен" : key === "mood" ? "1 — плохо · 5 — отлично" : "1 — плохо · 5 — отлично"}</span></div><div className={styles.ratingButtons}>{[1, 2, 3, 4, 5].map(value => <button key={value} disabled={!hydrated} aria-label={`${checkLabels[key]}: ${value} из 5`} aria-pressed={checks[key] === value} className={checks[key] === value ? styles.ratingSelected : ""} onClick={() => setStore(current => saveCheck(current, key, value, todayKey))}>{value}</button>)}</div></fieldset>)}</div></section>

      <section className={styles.weeklyPanel} id="weekly-review" aria-labelledby="weekly-title"><div className={styles.weeklyHeader}><h2 id="weekly-title">Недельный обзор</h2><div className={styles.groupFilters} role="group" aria-label="Виджеты недельного обзора">{(Object.keys(groupLabels) as WidgetGroup[]).map(group => <button key={group} className={store.widgets.includes(group) ? styles.groupActive : ""} aria-pressed={store.widgets.includes(group)} onClick={() => toggleGroup(group)}>{groupLabels[group]}{group === "state" && store.widgets.includes(group) && <Icon name="close" size={13} />}</button>)}<button className={styles.configureButton} aria-label="Настроить виджеты" onClick={() => setConfigureOpen(true)}><Icon name="plus" size={17} /></button></div></div><div className={styles.widgetGrid}>
        {store.widgets.includes("state") && <article className={styles.primaryCard} data-widget="mood"><CardHeader title="Настроение" subtitle={recordCount(mood.length)} value={lastValue(mood)} onExpand={() => openDetail("mood")} /><MoodDonut samples={mood} /></article>}
        {store.widgets.includes("sleep") && <article className={styles.primaryCard} data-widget="sleep"><CardHeader title="Сон и энергия" subtitle="7 дней" value={mean(nights.map(item => item.energy))} onExpand={() => openDetail("sleep")} /><SleepChart store={store} days={days} /><div className={styles.sleepStats}><div><span>Средний сон</span><strong>{nights.length ? formatHours(averageSleep) : "—"}</strong></div><div><span>Энергия сегодня</span><strong className={styles.cyanText}>{todayEnergy !== undefined ? todayEnergy.toFixed(1) : "—"} {todayEnergy !== undefined && (todayEnergy >= previousEnergy ? "↑" : "↓")}</strong></div><div><span>Пиковый день</span><strong>{peakDay ? `${new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(parseDate(peakDay.date))} · ${peakDay.energy.toFixed(1)}` : "—"}</strong></div></div></article>}
        {store.widgets.includes("state") && trendCard("readiness")}
        {store.widgets.includes("state") && trendCard("recovery")}
        {store.widgets.includes("nutrition") && trendCard("nutrition")}
        {store.widgets.includes("game") && trendCard("game")}
        {store.widgets.length === 0 && <div className={styles.emptyWidgets}><Icon name="chart" size={34} /><h3>Выберите, что хотите отслеживать</h3><p>Добавьте виджеты состояния, сна, питания или игры.</p><button className={shell.primaryButton} onClick={() => setConfigureOpen(true)}><Icon name="plus" size={17} /> Добавить виджет</button></div>}
      </div></section>
    </section>

    {detail && <Modal title={metricLabels[detail]} onClose={() => { setDetail(null); setAddingRecord(false); }} wide><div className={styles.detailBody}><div className={styles.detailSummary}><div><span>{detail === "sleep" ? "Средний сон за неделю" : "Среднее за неделю"}</span><strong>{detail === "sleep" ? formatHours(averageSleep) : mean(visibleSamples(metricSamples(store, detail), days).map(item => item.value)).toFixed(1)}{detail !== "sleep" && <small> / 10</small>}</strong></div><button className={shell.primaryButton} onClick={() => setAddingRecord(true)}><Icon name="plus" size={17} /> Добавить запись</button></div>{addingRecord && <RecordForm key={detail} metric={detail} today={todayKey} onSave={addRecord} onCancel={() => setAddingRecord(false)} />}<h3 className={styles.historyTitle}>История записей</h3>{detailSamples.length ? <div className={styles.historyList}>{detailSamples.map((sample, index) => <div key={`${sample.id}-${index}`}><span><strong>{dateFormatter.format(parseDate(sample.date))}</strong>{sample.note && <small>{sample.note}</small>}</span><strong>{detail === "sleep" ? formatHours(sample.value) : sample.value.toFixed(1)}{detail !== "sleep" && <small> / 10</small>}</strong></div>)}</div> : <p className={styles.historyEmpty}>Пока нет записей. Добавьте первую оценку.</p>}</div></Modal>}
    {configureOpen && <Modal title="Виджеты обзора" onClose={() => setConfigureOpen(false)}><div className={styles.configureBody}><p>Выберите показатели для своей главной страницы.</p>{(Object.keys(groupLabels) as WidgetGroup[]).map(group => <label key={group}><input type="checkbox" checked={store.widgets.includes(group)} onChange={() => toggleGroup(group)} /><span><strong>{groupLabels[group]}</strong><small>{{ state: "Настроение, готовность и восстановление", sleep: "Продолжительность сна и энергия", nutrition: "Регулярность и качество питания", game: "Самооценка игровой формы" }[group]}</small></span></label>)}</div><div className={shell.modalActions}><button className={shell.primaryButton} onClick={() => setConfigureOpen(false)}>Готово</button></div></Modal>}
    {notificationsOpen && <Modal title="Уведомления" onClose={() => setNotificationsOpen(false)}><div className={shell.notificationList}>{calendar?.notifications.length ? calendar.notifications.map(notification => <Link key={notification.id} className={styles.notificationItem} href={notification.eventId ? `/calendar?event=${encodeURIComponent(notification.eventId)}` : "/calendar"} onClick={() => { const next = { ...calendar, notifications: calendar.notifications.map(item => item.id === notification.id ? { ...item, read: true } : item) }; setCalendar(next); writeStore(next); }}><i className={!notification.read ? styles.notificationUnread : ""} /><span><strong>{notification.title}</strong><small>{notification.message}</small></span><Icon name="arrow" size={16} /></Link>) : <div className={shell.emptyAgenda}><h3>Нет уведомлений</h3><p>Здесь появятся напоминания о событиях календаря.</p></div>}</div></Modal>}
    {settingsOpen && <Modal title="Настройки обзора" onClose={() => setSettingsOpen(false)}><div className={shell.settingsBody}><div><h3>Ваши показатели</h3><p>Настройте набор виджетов на главной странице.</p><button className={shell.secondaryButton} onClick={() => { setSettingsOpen(false); setConfigureOpen(true); }}>Настроить виджеты</button></div><div><h3>Календарь</h3><p>Запланируйте тренировку, матч или личную встречу.</p><Link className={shell.primaryButton} href="/calendar">Открыть календарь</Link></div></div></Modal>}
    {toast && <div className={shell.toast} role="status"><span><Icon name="check" size={17} /></span>{toast}</div>}
  </main>;
}
