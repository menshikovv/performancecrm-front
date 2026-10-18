import type { Metadata } from "next";
import OverviewApp from "./overview-app";

export const metadata: Metadata = { title: "Обзор — Performance CRM", description: "Ежедневные оценки, настроение, сон и недельная статистика игрока." };
export default function OverviewPage() { return <OverviewApp />; }
