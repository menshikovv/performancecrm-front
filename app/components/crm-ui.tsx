"use client";

import Link from "next/link";
import Image from "next/image";
import { ReactNode, useEffect, useRef, useState } from "react";
import { PROFILE_EVENT, PROFILE_STORAGE_KEY, ProfileStore, initials, profileLabels, readProfile } from "../profile/profile-data";
import styles from "../calendar/calendar.module.css";

type IconName = "logo" | "grid" | "calendar" | "tests" | "energy" | "heart" | "chart" | "ball" | "card" | "sun" | "switch" | "menu" | "close" | "plus" | "arrow" | "bell" | "fire" | "check" | "left" | "right" | "play" | "clock" | "chevron" | "smile" | "sunrise" | "moon" | "edit" | "phone" | "food" | "logout" | "minus" | "users" | "strategy" | "pulse" | "image" | "network";
const paths: Record<IconName, ReactNode> = {
  logo: <path d="m4 18 5-14 5 14 3-9 4 9M8 11l3 3 3-3" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  tests: <><path d="M20 12v8H4V4h10M8 10l4 4 8-9"/></>,
  energy: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
  heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 12h4l2-4 4 8 2-4h6"/></>,
  chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
  ball: <><circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6 5-4ZM12 3v4M3 9l4 2M6 19l3-2M18 19l-3-2M21 9l-4 2"/></>,
  card: <><rect x="3" y="6" width="18" height="13" rx="1"/><path d="M3 10h18M6 14h5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
  switch: <path d="M5 8h13l-3-3M19 16H6l3 3"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="M18 6 6 18M6 6l12 12"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  pulse: <path d="M2 12h5l3-9 4 18 3-9h5"/>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 6-6 4 4 4-4 4 4"/></>,
  network: <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="m7 7 3 3m4 4 3 3M7 17l3-3m4-4 3-3"/></>,
  users: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/></>,
  strategy: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/></>,
  arrow: <path d="M7 17 17 7M7 7h10v10"/>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  fire: <path d="M12 2c1 5-4 7-4 11a4 4 0 0 0 8 0c0-1-.5-2-1-3 4 3 5 6 3 9a7 7 0 0 1-12-1C2 12 8 8 12 2Z"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  left: <path d="m15 18-6-6 6-6"/>, right: <path d="m9 18 6-6-6-6"/>,
  play: <path d="m8 4 12 8-12 8V4Z" fill="currentColor" stroke="none"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  chevron: <path d="m6 15 6-6 6 6"/>,
  smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/></>,
  sunrise: <><path d="M3 17h18M3 21h18M7 17a5 5 0 0 1 10 0M12 3v5m-3-3 3-3 3 3M3 10l2 2M21 10l-2 2M4 15H2M20 15h2"/></>,
  moon: <path d="M20.5 14.1A9 9 0 0 1 9.9 3.5a9 9 0 1 0 10.6 10.6Z"/>,
  edit: <><path d="m15 5 4 4M4 20l4-1L21 6l-4-4L4 15v5Z"/></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></>,
  food: <><path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v19M20 22V3c-4 1-5 5-5 10h5"/></>,
  logout: <><path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4"/></>,
};
export function CrmIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className={styles.icon} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function CrmSidebar({ active, role, mobileOpen, onClose, onSwitchRole, onSettings, onSection }: {
  active: "overview" | "calendar" | "tests" | "mood" | "recovery" | "stats" | "game" | "profile" | "plans" | "players" | "strategies"; role: "player" | "manager"; mobileOpen: boolean;
  onClose: () => void; onSwitchRole: () => void; onSettings: () => void; onSection: (section: string) => void;
}) {
  const [profile, setProfile] = useState<ProfileStore | null>(null);
  useEffect(() => {
    const refresh = () => { try { setProfile(localStorage.getItem(PROFILE_STORAGE_KEY) ? readProfile() : null); } catch { setProfile(null); } };
    const frame = requestAnimationFrame(refresh);
    const storage = (event: StorageEvent) => { if (event.key === PROFILE_STORAGE_KEY || event.key === null) refresh(); };
    window.addEventListener(PROFILE_EVENT, refresh); window.addEventListener("storage", storage); window.addEventListener("focus", refresh);
    return () => { cancelAnimationFrame(frame); window.removeEventListener(PROFILE_EVENT, refresh); window.removeEventListener("storage", storage); window.removeEventListener("focus", refresh); };
  }, []);
  const nickname = role === "manager" && (!profile || profile.nickname === "NICKNAME12345") ? "Coach" : profile?.nickname ?? "NICKNAME12345";
  const subtitle = role === "manager" ? "Staff · Atlant Esports" : profile?.active === "team" ? profileLabels.team : profileLabels.solo;
  return <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
    <Link className={styles.brand} href="/overview" aria-label="Performance CRM — обзор" onClick={onClose}><div className={styles.brandMark}><CrmIcon name="logo" size={25} /></div><div><span>ATLANT TECHNOLOGY</span><strong>Performance CRM</strong></div></Link>
    <nav aria-label="Главная навигация">
      <Link href="/overview" className={active === "overview" ? styles.navActive : ""} aria-current={active === "overview" ? "page" : undefined} onClick={onClose}><CrmIcon name="grid" /> Обзор</Link>
      <Link href="/calendar" className={active === "calendar" ? styles.navActive : ""} aria-current={active === "calendar" ? "page" : undefined} onClick={onClose}><CrmIcon name="calendar" /> Календарь</Link>
      {role === "manager" ? <><span className={styles.navGroup}>Команда</span><Link href="/players" className={active === "players" ? styles.navActive : ""} aria-current={active === "players" ? "page" : undefined} onClick={onClose}><CrmIcon name="users"/> Игроки</Link><Link href="/strategies" className={active === "strategies" ? styles.navActive : ""} aria-current={active === "strategies" ? "page" : undefined} onClick={onClose}><CrmIcon name="strategy"/> Раскидки и скрипты</Link></> : <><span className={styles.navGroup}>Состояние</span>
      <Link href="/tests" className={active === "tests" ? styles.navActive : ""} aria-current={active === "tests" ? "page" : undefined} onClick={onClose}><CrmIcon name="tests" /> Тесты</Link>
      <Link href="/mood" className={active === "mood" ? styles.navActive : ""} aria-current={active === "mood" ? "page" : undefined} onClick={onClose}><CrmIcon name="energy" /> Настроение и энергия</Link>
      <Link href="/recovery" className={active === "recovery" ? styles.navActive : ""} aria-current={active === "recovery" ? "page" : undefined} onClick={onClose}><CrmIcon name="heart" /> Восстановление</Link>
      </>}
      <span className={styles.navGroup}>Аналитика</span>
      <Link href="/stats" className={active === "stats" ? styles.navActive : ""} aria-current={active === "stats" ? "page" : undefined} onClick={onClose}><CrmIcon name="chart" /> Статистика</Link>
      <Link href="/game" className={active === "game" ? styles.navActive : ""} aria-current={active === "game" ? "page" : undefined} onClick={onClose}><CrmIcon name="ball" /> Игровая статистика</Link>
    </nav>
    <div className={styles.sidebarBottom}>
      {role === "player" && <Link href="/plans" onClick={onClose} className={`${styles.tariffButton} ${active === "plans" ? styles.tariffActive : ""}`} aria-current={active === "plans" ? "page" : undefined}><CrmIcon name="card" /> Тарифы</Link>}
      <div className={`${styles.profile} ${active === "profile" ? styles.profileActive : ""}`}><Link href="/profile" onClick={onClose} className={styles.profileIdentity} aria-label="Открыть профиль" aria-current={active === "profile" ? "page" : undefined}><div className={`${styles.avatar} ${role === "manager" ? styles.staffAvatar : ""}`}>{profile?.photo ? <Image src={profile.photo} alt="" width={41} height={41} unoptimized/> : initials(nickname)}</div><div><strong title={nickname}>{nickname}</strong><span>{subtitle}</span></div></Link><button onClick={onSettings} aria-label="Настройки приложения"><CrmIcon name="sun" size={20} /></button></div>
      <button className={styles.roleSwitch} onClick={() => { onSwitchRole(); onClose(); }}><CrmIcon name="switch" size={16} /> Демо: открыть как {role === "player" ? "Staff" : "игрок"}</button>
    </div>
  </aside>;
}

export function CrmModal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button, a[href]")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]") ?? []);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); previousFocus?.focus({ preventScroll: true }); };
  }, []);
  return <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div ref={panelRef} className={`${styles.modal} ${wide ? styles.modalWide : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className={styles.modalHeader}><h2>{title}</h2><button className={styles.iconButton} onClick={onClose} aria-label="Закрыть"><CrmIcon name="close" /></button></div>{children}</div></div>;
}
