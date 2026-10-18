import type { Metadata } from "next";
import PlansApp from "../plans-app";

export const metadata: Metadata = { title: "Подтверждение — Performance CRM", description: "Результат демонстрационного оформления доступа." };
export default function ConfirmationPage() { return <PlansApp confirmation />; }
