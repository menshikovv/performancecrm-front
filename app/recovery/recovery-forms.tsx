"use client";

import { FormEvent, useState } from "react";
import { Meal, Metric, RecoveryStore, ScreenRecord, SleepRecord, sleepMinutes, Targets, validDate, validTime, duration } from "./recovery-data";
import shell from "../calendar/calendar.module.css";
import styles from "./recovery.module.css";

export interface Editing { metric: Metric; date: string; mealId?: string; adding?: boolean }
export type SavedRecord = { metric: "sleep"; entry: SleepRecord } | { metric: "screen"; entry: ScreenRecord } | { metric: "nutrition"; entry: Meal };

export function RecordForm({ editing, store, today, onSave }: { editing: Editing; store: RecoveryStore; today: string; onSave: (record: SavedRecord) => void }) {
  const initialSleep = !editing.adding && editing.metric === "sleep" ? store.sleep.find(day => day.date === editing.date) : undefined;
  const initialScreen = !editing.adding && editing.metric === "screen" ? store.screen.find(day => day.date === editing.date) : undefined;
  const initialMeal = editing.mealId ? store.meals.find(meal => meal.id === editing.mealId) : undefined;
  const [date, setDate] = useState(initialMeal?.date ?? editing.date);
  const [bedTime, setBedTime] = useState(initialSleep?.bedTime ?? "23:00");
  const [wakeTime, setWakeTime] = useState(initialSleep?.wakeTime ?? "07:00");
  const [durationOnly, setDurationOnly] = useState(!!initialSleep && initialSleep.bedTime === null);
  const initialMinutes = editing.metric === "sleep" ? initialSleep?.minutes ?? 480 : initialScreen?.minutes ?? 300;
  const [hours, setHours] = useState(String(Math.floor(initialMinutes / 60)));
  const [minutes, setMinutes] = useState(String(initialMinutes % 60));
  const [name, setName] = useState(initialMeal?.name ?? "");
  const [time, setTime] = useState(initialMeal?.time ?? "13:00");
  const [energy, setEnergy] = useState(initialMeal ? String(initialMeal.calories) : "500");
  const [note, setNote] = useState(initialMeal?.note ?? initialSleep?.note ?? initialScreen?.note ?? "");
  const [error, setError] = useState("");
  const lockedDate = !!initialSleep || !!initialScreen;
  const total = editing.metric === "sleep" && !durationOnly ? sleepMinutes(bedTime, wakeTime) : Number(hours) * 60 + Number(minutes);
  const replacing = editing.adding && editing.metric !== "nutrition" && store[editing.metric].some(day => day.date === date);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validDate(date) || date > today) { setError("Выберите сегодняшнюю или прошедшую дату"); return; }
    if (editing.metric === "nutrition") {
      if (!name.trim()) { setError("Укажите название приёма пищи"); return; }
      if (!validTime(time)) { setError("Укажите время приёма пищи"); return; }
      if (!energy.trim() || !Number.isInteger(Number(energy)) || Number(energy) <= 0 || Number(energy) > 20000) { setError("Укажите калорийность от 1 до 20 000 ккал"); return; }
      onSave({ metric: "nutrition", entry: { id: initialMeal?.id ?? crypto.randomUUID(), date, time, name: name.trim(), calories: Number(energy), source: "manual", note: note.trim() } });
      return;
    }
    if (editing.metric === "screen" || durationOnly) {
      if (!hours.trim() || !minutes.trim() || !Number.isInteger(Number(hours)) || !Number.isInteger(Number(minutes)) || Number(hours) < 0 || Number(hours) > 24 || Number(minutes) < 0 || Number(minutes) > 59 || total > (editing.metric === "sleep" ? 1439 : 1440) || (editing.metric === "sleep" && total <= 0)) { setError("Проверьте длительность: часы от 0 до 24, минуты от 0 до 59; всего не больше суток"); return; }
    } else if (!validTime(bedTime) || !validTime(wakeTime) || total <= 0) { setError("Укажите разное время отхода ко сну и подъёма"); return; }
    if (editing.metric === "sleep") onSave({ metric: "sleep", entry: { date, bedTime: durationOnly ? null : bedTime, wakeTime: durationOnly ? null : wakeTime, minutes: total, source: "manual", note: note.trim() } });
    else onSave({ metric: "screen", entry: { date, minutes: total, source: "manual", note: note.trim() } });
  };
  return <form noValidate onSubmit={submit}>
    <div className={styles.formBody}>
      <p className={styles.formIntro}>{editing.metric === "sleep" ? "Ночь относится к дате подъёма. Если вы легли до полуночи, длительность рассчитается с учётом перехода на следующий день." : editing.metric === "screen" ? "Укажите суммарное экранное время за выбранный день." : "Добавьте приём пищи вручную. Калории суммируются в итог дня."}</p>
      <label className={shell.field}><span>{editing.metric === "sleep" ? "Дата подъёма" : "Дата"}</span><input type="date" value={date} max={today} readOnly={lockedDate} aria-label="Дата записи" onChange={event => setDate(event.target.value)}/></label>
      {editing.metric === "sleep" && <label className={styles.checkbox}><input type="checkbox" checked={durationOnly} onChange={event => setDurationOnly(event.target.checked)}/> Указать только длительность</label>}
      {editing.metric === "sleep" && !durationOnly ? <><div className={shell.formGrid}><label className={shell.field}><span>Отход ко сну</span><input type="time" value={bedTime} onChange={event => setBedTime(event.target.value)}/></label><label className={shell.field}><span>Подъём</span><input type="time" value={wakeTime} onChange={event => setWakeTime(event.target.value)}/></label></div><p className={styles.calculated}>Длительность <strong>{duration(total)}</strong></p></> : editing.metric !== "nutrition" ? <div className={shell.formGrid}><label className={shell.field}><span>Часы</span><input type="number" min="0" max="24" step="1" value={hours} onChange={event => setHours(event.target.value)}/></label><label className={shell.field}><span>Минуты</span><input type="number" min="0" max="59" step="1" value={minutes} onChange={event => setMinutes(event.target.value)}/></label></div> : <><label className={shell.field}><span>Приём пищи</span><input value={name} maxLength={80} placeholder="Например, обед" onChange={event => setName(event.target.value)}/></label><div className={shell.formGrid}><label className={shell.field}><span>Время</span><input type="time" value={time} onChange={event => setTime(event.target.value)}/></label><label className={shell.field}><span>Калорийность, ккал</span><input type="number" min="1" max="20000" step="1" value={energy} onChange={event => setEnergy(event.target.value)}/></label></div></>}
      <label className={shell.field}><span>Заметка</span><textarea rows={2} value={note} maxLength={300} onChange={event => setNote(event.target.value)} placeholder="Необязательно"/></label>
      {replacing && <p className={styles.formNotice}>За эту дату уже есть запись. Сохранение заменит её ручными данными.</p>}
      {error && <p className={styles.formError} role="alert">{error}</p>}
    </div>
    <div className={shell.modalActions}><button className={shell.primaryButton} type="submit">Сохранить запись</button></div>
  </form>;
}

export function TargetForm({ initial, onSave }: { initial: Targets; onSave: (targets: Targets) => void }) {
  const [sleep, setSleep] = useState(String(initial.sleep / 60));
  const [screen, setScreen] = useState(String(initial.screen / 60));
  const [food, setFood] = useState(String(initial.nutrition));
  const [error, setError] = useState("");
  return <form noValidate onSubmit={event => { event.preventDefault(); const values = [sleep, screen, food].map(Number); if ([sleep, screen, food].some(value => !value.trim()) || values.some(value => !Number.isFinite(value)) || values[0] < 1 || values[0] > 16 || values[1] < .5 || values[1] > 24 || values[2] < 500 || values[2] > 10000) { setError("Проверьте ориентиры: сон 1–16 ч, экранное время 0,5–24 ч, питание 500–10 000 ккал"); return; } onSave({ sleep: Math.round(values[0] * 60), screen: Math.round(values[1] * 60), nutrition: Math.round(values[2]) }); }}>
    <div className={styles.formBody}><p className={styles.formIntro}>Это ваши личные ориентиры для графиков и сравнений, а не медицинские рекомендации.</p>{[{ label: "Сон, часов", value: sleep, set: setSleep, min: 1, max: 16, step: .5 }, { label: "Экранное время, часов", value: screen, set: setScreen, min: .5, max: 24, step: .5 }, { label: "Питание, ккал", value: food, set: setFood, min: 500, max: 10000, step: 50 }].map(field => <label className={shell.field} key={field.label}><span>{field.label}</span><input type="number" min={field.min} max={field.max} step={field.step} value={field.value} onChange={event => field.set(event.target.value)}/></label>)}{error && <p className={styles.formError} role="alert">{error}</p>}</div><div className={shell.modalActions}><button className={shell.primaryButton}>Сохранить ориентиры</button></div>
  </form>;
}
