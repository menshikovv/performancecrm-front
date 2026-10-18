import type { Metadata } from "next";
import PlayersApp from "./players-app";
export const metadata: Metadata = { title: "Игроки — Performance CRM", description: "Состав команды, готовность и карточки игроков для Staff." };
export default function PlayersPage() { return <PlayersApp/>; }
