import type { Metadata } from "next";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";
import "./motion.css";
import CrmMotion from "./components/crm-motion";

export const metadata: Metadata = {
  title: "Performance — Авторизация",
  description: "Вход и регистрация в Performance CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">{children}<CrmMotion/></body>
    </html>
  );
}
