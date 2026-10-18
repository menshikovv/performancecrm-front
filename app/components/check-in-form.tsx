"use client";

import { useState } from "react";
import { parseDate } from "../overview/overview-data";
import { CheckIn, DaySlot, slotLabels } from "../tests/tests-data";
import shell from "../calendar/calendar.module.css";
import styles from "./check-in-form.module.css";

export function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <fieldset className={styles.scoreInput}>
    <legend>{label}<span>{value} / 10</span></legend>
    <div>{Array.from({ length: 10 }, (_, index) => index + 1).map(score => <button type="button" key={score} aria-label={`${label}: ${score} из 10`} aria-pressed={value === score} className={value === score ? styles.selected : ""} onClick={() => onChange(score)}>{score}</button>)}</div>
    <p>1 — {label === "Усталость" ? "нет усталости" : label === "Энергия" ? "нет сил" : "минимум"} · 10 — {label === "Усталость" ? "сильная усталость" : label === "Энергия" ? "полон сил" : "максимум"}</p>
  </fieldset>;
}

export function CheckInForm({ date, slot, initial, onSave }: { date: string; slot: DaySlot; initial?: CheckIn; onSave: (item: CheckIn) => void }) {
  const [mood, setMood] = useState(initial?.mood ?? 7);
  const [energy, setEnergy] = useState(initial?.energy ?? 6);
  const [note, setNote] = useState(initial?.note ?? "");
  const formatted = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(parseDate(date));
  return <form onSubmit={event => { event.preventDefault(); onSave({ date, slot, mood, energy, note: note.trim() }); }}>
    <div className={styles.formBody}>
      <p className={styles.intro}>{formatted} · {slotLabels[slot]}. Оцените, как вы чувствуете себя сейчас.</p>
      <ScoreInput label="Настроение" value={mood} onChange={setMood}/>
      <ScoreInput label="Энергия" value={energy} onChange={setEnergy}/>
      <label className={shell.field}><span>Заметка</span><textarea value={note} maxLength={300} rows={3} onChange={event => setNote(event.target.value)} placeholder="Что повлияло на ваше состояние?"/></label>
    </div>
    <div className={shell.modalActions}><button className={shell.primaryButton} type="submit">Сохранить отметку</button></div>
  </form>;
}
