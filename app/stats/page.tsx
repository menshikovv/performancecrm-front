import type { Metadata } from "next";
import StatsApp from "./stats-app";

export const metadata: Metadata = { title: "Статистика — Performance CRM", description: "Динамика состояния и формы, восстановление, когнитивные тесты, колесо баланса и корреляционный анализ." };
export default function StatsPage() { return <StatsApp/>; }
