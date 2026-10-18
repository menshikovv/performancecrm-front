import type { Metadata } from "next";
import StrategiesApp from "./strategies-app";

export const metadata: Metadata = { title: "Раскидки и скрипты — Performance CRM", description: "Командная база раскидок и тактических материалов CS2." };
export default function StrategiesPage() { return <StrategiesApp/>; }
