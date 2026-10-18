import type { Metadata } from "next";
import RecoveryApp from "./recovery-app";

export const metadata: Metadata = { title: "Восстановление — Performance CRM", description: "Сон, экранное время и питание: динамика за 7, 14 и 30 дней, история и ручные записи." };
export default function RecoveryPage() { return <RecoveryApp/>; }
