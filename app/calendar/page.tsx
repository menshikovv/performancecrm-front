import type { Metadata } from "next";
import CalendarApp from "./calendar-app";

export const metadata: Metadata = {
  title: "Календарь команды — Performance CRM",
  description: "Интерактивный календарь тренировок, матчей и командных событий.",
};

export default function CalendarPage() {
  return <CalendarApp />;
}
