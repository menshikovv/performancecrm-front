import type { Metadata } from "next";
import ProfileApp from "./profile-app";

export const metadata: Metadata = { title: "Профиль — Performance CRM", description: "Личные данные, подписка и профили Performance CRM." };
export default function ProfilePage() { return <ProfileApp />; }
