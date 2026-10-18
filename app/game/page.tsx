import type { Metadata } from "next";
import GameApp from "./game-app";

export const metadata: Metadata = { title: "Игровая статистика — Performance CRM", description: "Записи игр по картам, статистика игроков, автоматические итоги, история и сводка." };
export default function GamePage() { return <GameApp/>; }
