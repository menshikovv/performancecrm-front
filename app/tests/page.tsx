import type { Metadata } from "next";
import TestsApp from "./tests-app";

export const metadata: Metadata = { title: "Тесты — Performance CRM", description: "Ежедневные когнитивные тесты, настроение, игровые опросы и итоги недели." };
export default function TestsPage() { return <TestsApp />; }
