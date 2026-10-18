import { dateKey, dateOffset, mean, OverviewStore, saveCheck } from "../overview/overview-data";
import type { CheckIn, DaySlot, TestsStore } from "../tests/tests-data";

export const daySlots: DaySlot[] = ["morning", "afternoon", "evening"];
export const slotDescriptions: Record<DaySlot, string> = {
  morning: "после пробуждения", afternoon: "после основной нагрузки", evening: "перед сном",
};
export const slotPrompts: Record<DaySlot, string> = {
  morning: "Начните день с короткой отметки: как вы чувствуете себя после сна?",
  afternoon: "Оцените своё состояние после основной нагрузки и тренировок.",
  evening: "Итог дня: насколько удалось восстановиться после матчей и тренировок.",
};

export function createDemoCheckins(today: Date): CheckIn[] {
  const values: Array<Array<[number, number] | null>> = [
    [[6, 5], [7, 6], [5, 4]],
    [[4, 4], null, [5, 5]],
    [null, [8, 7], null],
    [[3, 4], [5, 5], [4, 4]],
    [[5, 5], [8, 10], null],
  ];
  return values.flatMap((scores, index) => scores.flatMap((score, slot) => score ? [{
    date: dateKey(dateOffset(today, index - 4)), slot: daySlots[slot], mood: score[0], energy: score[1], note: "",
  }] : []));
}

export function summarizeDay(checkins: CheckIn[], date: string) {
  const entries = daySlots.flatMap(slot => {
    const entry = checkins.find(item => item.date === date && item.slot === slot);
    return entry ? [entry] : [];
  });
  return { entries, mood: entries.length ? mean(entries.map(item => item.mood)) : null, energy: entries.length ? mean(entries.map(item => item.energy)) : null };
}

export function withCheckIn(store: TestsStore, item: CheckIn): TestsStore {
  return { ...store, checkins: [...store.checkins.filter(entry => entry.date !== item.date || entry.slot !== item.slot), item] };
}

export function overviewWithCheckins(store: OverviewStore, checkins: CheckIn[], date: string): OverviewStore {
  const { entries, mood, energy } = summarizeDay(checkins, date);
  if (!entries.length || mood === null || energy === null) return store;
  let updated = saveCheck(store, "mood", Math.max(1, Math.round(mood / 2)), date);
  updated = saveCheck(updated, "energy", Math.max(1, Math.round(energy / 2)), date);
  return {
    ...updated,
    mood: updated.mood.map(entry => entry.id === `daily-mood-${date}` ? { ...entry, value: mood } : entry),
    sleep: updated.sleep.map(entry => entry.date === date ? { ...entry, energy } : entry),
  };
}
