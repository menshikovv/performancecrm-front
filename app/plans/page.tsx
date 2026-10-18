import type { Metadata } from "next";
import PlansApp from "./plans-app";

export const metadata: Metadata = { title: "Тарифы — Performance CRM", description: "Полный доступ PerformanceCoach CRM, игровые модули и сравнение тарифов." };
export default function PlansPage() { return <PlansApp />; }
