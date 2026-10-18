import type { Metadata } from "next";
import MoodApp from "./mood-app";

export const metadata: Metadata = {
  title: "Настроение и энергия — Performance CRM",
  description: "Личный трекер состояния: отметки утром, днём и вечером, настроение и энергия за неделю.",
};

export default function MoodPage() { return <MoodApp/>; }
