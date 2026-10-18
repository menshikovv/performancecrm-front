"use client";

import { useEffect, useMemo, useState } from "react";
import { CrmIcon as Icon, CrmModal as Modal } from "../components/crm-ui";
import { dateKey, dateOffset, parseDate } from "../overview/overview-data";
import { PlayerId, staffPlayers } from "../overview/staff-data";
import { NUTRITION_STORAGE_KEY, NutritionPreferences, createTeamMeals, dayLabel, dayNutrition, filterTeamMeals, mealsLabel, readNutritionPreferences, recordsLabel, validTarget } from "./nutrition-data";
import styles from "./team-nutrition.module.css";

const number = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
function Camera({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6l2-3h4l2 3h5v15H3V6h5Z"/><circle cx="12" cy="13" r="4"/></svg>;
}
function MealVisual({ photo, large = false }: { photo: boolean; large?: boolean }) {
  return <div className={`${styles.mealVisual} ${photo ? styles.withPhoto : styles.withoutPhoto} ${large ? styles.largeVisual : ""}`} aria-hidden="true">{photo ? <Camera size={large ? 38 : 23}/> : <Icon name="food" size={large ? 38 : 25}/>}<span>{photo ? "Фото" : "без фото"}</span></div>;
}

export default function TeamNutrition({ today }: { today: Date }) {
  const todayKey = dateKey(today);
  const [preferences, setPreferences] = useState<NutritionPreferences | null>(null);
  const [error, setError] = useState("");
  const [mealId, setMealId] = useState<string | null>(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetDraft, setTargetDraft] = useState<Record<PlayerId, { calories: string; water: string }> | null>(null);
  const [targetError, setTargetError] = useState("");
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const meals = useMemo(() => createTeamMeals(parseDate(todayKey)), [todayKey]);

  useEffect(() => {
    const load = () => setPreferences(readNutritionPreferences(parseDate(todayKey)));
    const frame = requestAnimationFrame(load);
    const storage = (event: StorageEvent) => { if (event.key === NUTRITION_STORAGE_KEY || event.key === null) load(); };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", load);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("storage", storage); window.removeEventListener("focus", load); };
  }, [todayKey]);

  const update = (change: (value: NutritionPreferences) => NutritionPreferences) => {
    try {
      const next = change(readNutritionPreferences(today));
      localStorage.setItem(NUTRITION_STORAGE_KEY, JSON.stringify(next));
      setPreferences(next); setError(""); return true;
    } catch { setError("Не удалось сохранить настройки питания. Проверьте доступ к хранилищу браузера."); return false; }
  };
  const selectPeriod = (period: 1 | 3 | 7) => {
    setMealId(null);
    update(value => ({ ...value, period, day: value.day < dateKey(dateOffset(today, 1 - period)) ? todayKey : value.day }));
  };
  const selectPlayer = (player: PlayerId | "all") => { setMealId(null); update(value => ({ ...value, player })); };
  const editTargets = () => {
    if (!preferences) return;
    setTargetDraft(Object.fromEntries(staffPlayers.map(p => [p.id, { calories: String(preferences.targets[p.id].calories), water: String(preferences.targets[p.id].water).replace(".", ",") }])) as Record<PlayerId, { calories: string; water: string }>);
    setTargetError(""); setEditingTargets(true);
  };
  const saveTargets = () => {
    if (!targetDraft) return;
    const targets = Object.fromEntries(staffPlayers.map(p => [p.id, { calories: Number(targetDraft[p.id].calories.trim()), water: Number(targetDraft[p.id].water.trim().replace(",", ".")) }])) as NutritionPreferences["targets"];
    if (staffPlayers.some(p => !validTarget(targets[p.id]))) { setTargetError("Укажите целое число калорий от 1 до 10 000 и воду от 0,1 до 10 л для каждого игрока."); return; }
    if (update(value => ({ ...value, targets }))) setEditingTargets(false);
  };

  if (!preferences) return <p role="status">Загрузка питания команды…</p>;
  const visible = filterTeamMeals(meals, preferences, today);
  const days = Array.from({ length: preferences.period }, (_, ago) => dateKey(dateOffset(today, -ago)));
  const meal = meals.find(row => row.id === mealId);
  const mealIndex = visible.findIndex(row => row.id === mealId);
  const currentPlayer = meal ? staffPlayers.find(p => p.id === meal.player)! : null;
  const photoCount = visible.filter(m => m.photo).length;

  return <section className={styles.nutrition} aria-label="Питание команды">
    <div className={styles.filterBar}>
      <div className={styles.playerFilters} role="group" aria-label="Фильтр питания по игроку">
        <button className={preferences.player === "all" ? styles.active : ""} aria-pressed={preferences.player === "all"} onClick={() => selectPlayer("all")}>Все игроки</button>
        {staffPlayers.map(player => <button key={player.id} className={preferences.player === player.id ? styles.active : ""} aria-pressed={preferences.player === player.id} onClick={() => selectPlayer(player.id)}>{player.name}</button>)}
      </div>
      <div className={styles.feedFilters}>
        <div className={styles.periods} role="group" aria-label="Период ленты питания">{([{ days: 1, label: "Сегодня" }, { days: 3, label: "3 дня" }, { days: 7, label: "7 дней" }] as const).map(period => <button key={period.days} className={preferences.period === period.days ? styles.active : ""} aria-pressed={preferences.period === period.days} onClick={() => selectPeriod(period.days)}>{period.label}</button>)}</div>
        <button className={`${styles.photoFilter} ${preferences.photosOnly ? styles.active : ""}`} aria-pressed={preferences.photosOnly} onClick={() => { setMealId(null); update(value => ({ ...value, photosOnly: !value.photosOnly })); }}><Camera size={15}/>Только с фото</button>
      </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.layout}>
      <div className={styles.feed}>
        <p className={styles.resultCount} role="status">{recordsLabel(visible.length)} · {photoCount} с фото</p>
        {visible.length ? days.map(day => {
          const rows = visible.filter(m => m.date === day);
          if (!rows.length) return null;
          return <section key={day} className={styles.dayGroup} aria-label={dayLabel(day, today)}>
            <div className={styles.dayHeading}><button onClick={() => update(value => ({ ...value, day }))} title="Показать сводку за этот день" aria-label={`Сводка: ${dayLabel(day, today)}`}>{dayLabel(day, today, true)}</button><span>{recordsLabel(rows.length)}</span></div>
            <div className={styles.mealGrid}>{rows.map(row => {
              const player = staffPlayers.find(p => p.id === row.player)!;
              return <button className={styles.mealCard} key={row.id} onClick={() => setMealId(row.id)} aria-label={`${row.title}, ${player.name}, ${row.calories} ккал, ${row.time}`} data-meal-player={row.player} data-meal-photo={row.photo}>
                <div className={styles.cardImage}><MealVisual photo={row.photo}/><span className={styles.playerTag}>{player.name}</span></div>
                <div className={styles.mealText}><strong>{row.title}</strong><span>{number(row.calories)} ккал · {row.time}</span></div>
              </button>;
            })}</div>
          </section>;
        }) : <div className={styles.empty}><Icon name="food" size={34}/><h2>Нет записей с такими фильтрами</h2><p>Покажите записи без фото или выберите других игроков.</p><button onClick={() => update(value => ({ ...value, player: "all", photosOnly: false }))}>Сбросить фильтры</button></div>}
        <p className={styles.demoNote}>Демоданные. Тёплые превью обозначают пример записи с фотографией; настоящие фото и синхронизация с приложением пока не подключены.</p>
      </div>
      <aside className={styles.dailySummary} aria-labelledby="nutrition-summary-title">
        <h2 id="nutrition-summary-title">Сводка за день</h2>
        <label className={styles.summaryDate}><select aria-label="День сводки питания" value={preferences.day} onChange={event => update(value => ({ ...value, day: event.target.value }))}>{days.map(day => <option key={day} value={day}>{dayLabel(day, today)}</option>)}</select></label>
        <p className={styles.summaryIntro}>Нажмите на игрока, чтобы показать только его записи</p>
        <button className={styles.mobileSummaryToggle} aria-expanded={summaryExpanded} aria-controls="team-nutrition-summary" onClick={() => setSummaryExpanded(value => !value)}>{summaryExpanded ? "Свернуть сводку" : "Показать сводку по игрокам"}<Icon name={summaryExpanded ? "minus" : "plus"} size={15}/></button>
        <div id="team-nutrition-summary" className={`${styles.summaryContent} ${summaryExpanded ? styles.expandedSummary : ""}`}>
        <div className={styles.summaryList}>{staffPlayers.map(player => {
          const totals = dayNutrition(meals, player.id, preferences.day, today), target = preferences.targets[player.id];
          const few = totals.count < 2, over = totals.calories > target.calories;
          const label = !totals.count ? "Нет записей" : few ? "Мало записей" : over ? "Выше ориентира" : "В норме";
          return <button key={player.id} className={`${styles.playerSummary} ${preferences.player === player.id ? styles.selectedSummary : ""}`} aria-label={`Показать питание ${player.name}`} aria-pressed={preferences.player === player.id} onClick={() => selectPlayer(preferences.player === player.id ? "all" : player.id)}>
            <div className={styles.summaryTop}><span className={styles.miniAvatar}>{player.name.slice(0, 2).toUpperCase()}</span><strong>{player.name}</strong><span className={`${styles.status} ${few || over ? styles.warning : ""}`} title="Статус заполнения дневника, не оценка качества рациона">{label}</span></div>
            <div className={styles.calorieLine}><span>{number(totals.calories)} / {number(target.calories)} ккал</span><span>{mealsLabel(totals.count)}</span></div>
            <div className={styles.progress} role="meter" aria-label={`Калории ${player.name}`} aria-valuemin={0} aria-valuemax={target.calories} aria-valuenow={Math.min(totals.calories, target.calories)} aria-valuetext={`${totals.calories} из ${target.calories} ккал`}><span className={few || over ? styles.warningBar : ""} style={{ width: `${Math.min(100, totals.calories / target.calories * 100)}%` }}/></div>
            <div className={styles.macros}><span>Б {totals.protein} г</span><span>Ж {totals.fat} г</span><span>У {totals.carbs} г</span><span>Вода {number(totals.water)} / {number(target.water)} л</span></div>
          </button>;
        })}</div>
        <p className={styles.summaryFootnote}>2 400 ккал — ориентир по умолчанию, его можно изменить у каждого игрока. Сводка учитывает все записи дня, в том числе без фото.</p>
        <button className={styles.editTargets} onClick={editTargets}><Icon name="edit" size={13}/>Настроить ориентиры</button>
        </div>
      </aside>
    </div>
    {meal && currentPlayer && <Modal title={meal.title} onClose={() => setMealId(null)}>
      <div className={styles.mealDetail}><MealVisual photo={meal.photo} large/><div className={styles.detailMeta}><span className={styles.miniAvatar}>{currentPlayer.name.slice(0, 2).toUpperCase()}</span><strong>{currentPlayer.name}</strong><span>{dayLabel(meal.date, today)} · {meal.time}</span></div><div className={styles.mealMetrics}>{[["Калории", `${number(meal.calories)} ккал`], ["Белки", `${meal.protein} г`], ["Жиры", `${meal.fat} г`], ["Углеводы", `${meal.carbs} г`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p>{meal.photo ? "Это демонстрационное превью. Настоящее фото блюда пока не загружено." : "К этой записи фотография не добавлена."} Калории и БЖУ — пример, а не результат распознавания фотографии.</p><div className={styles.modalNavigation}><button disabled={mealIndex <= 0} onClick={() => setMealId(visible[mealIndex - 1].id)}><Icon name="left" size={15}/>Предыдущая</button><span>{mealIndex + 1} / {visible.length}</span><button disabled={mealIndex < 0 || mealIndex >= visible.length - 1} onClick={() => setMealId(visible[mealIndex + 1].id)}>Следующая<Icon name="right" size={15}/></button></div></div>
    </Modal>}
    {editingTargets && targetDraft && <Modal title="Ориентиры питания" onClose={() => setEditingTargets(false)}>
      <form className={styles.targetsForm} onSubmit={event => { event.preventDefault(); saveTargets(); }} noValidate><p>Личные ориентиры для отображения прогресса. Это не рекомендации по питанию; изменения сохраняются только в этом браузере.</p><div className={styles.targetHead}><span>Игрок</span><span>Ккал в день</span><span>Вода, л</span></div>{staffPlayers.map(player => <div className={styles.targetRow} key={player.id}><strong>{player.name}</strong><input aria-label={`Калории ${player.name}`} inputMode="numeric" maxLength={5} value={targetDraft[player.id].calories} onChange={event => { setTargetError(""); setTargetDraft(value => value && ({ ...value, [player.id]: { ...value[player.id], calories: event.target.value } })); }}/><input aria-label={`Вода ${player.name}`} inputMode="decimal" maxLength={4} value={targetDraft[player.id].water} onChange={event => { setTargetError(""); setTargetDraft(value => value && ({ ...value, [player.id]: { ...value[player.id], water: event.target.value } })); }}/></div>)}{targetError && <p className={styles.error} role="alert">{targetError}</p>}{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.targetActions}><button type="button" onClick={() => setEditingTargets(false)}>Отмена</button><button type="submit" className={styles.saveButton}>Сохранить</button></div></form>
    </Modal>}
  </section>;
}
