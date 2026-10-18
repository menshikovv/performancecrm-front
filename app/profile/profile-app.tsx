"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { CrmIcon as Icon, CrmModal as Modal, CrmSidebar } from "../components/crm-ui";
import { CalendarStore, readStore, writeStore } from "../calendar/calendar-data";
import { OverviewStore, readOverviewStore, streakDays } from "../overview/overview-data";
import shell from "../calendar/calendar.module.css";
import styles from "./profile.module.css";
import { accessSummary, billingFor, briefDate, daysLabel, longDate, periodState } from "../plans/plans-data";
import { PROFILE_STORAGE_KEY, ProfileKind, ProfileStore, demoMembership, initialProfile, initials, profileLabels, readProfile, validateDetails, validatePasswords, writeProfile } from "./profile-data";

type Dialog = "password" | "delete" | "logout" | "codes" | "settings" | "streak" | "notifications" | null;
const descriptions: Record<ProfileKind, string> = { solo: "Личный режим, без команды", team: "Команда Atlant · демопрофиль", staff: "Управление командой · демопрофиль" };

export default function ProfileApp() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileStore | null>(null);
  const [details, setDetails] = useState<Pick<ProfileStore, "name" | "nickname" | "faceit" | "photo"> | null>(null);
  const [calendar, setCalendar] = useState<CalendarStore | null>(null);
  const [overview, setOverview] = useState<OverviewStore | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const [joinKind, setJoinKind] = useState<"team" | "staff">("team");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "", repeat: "" });
  const [deleteName, setDeleteName] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRequest = useRef(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const load = (replaceDetails: boolean) => { const date = new Date(); const saved = readProfile(date); setNow(date); setProfile(saved); setCalendar(readStore()); setOverview(readOverviewStore(date)); if (replaceDetails || !dirtyRef.current) setDetails({ name: saved.name, nickname: saved.nickname, faceit: saved.faceit, photo: saved.photo }); };
    const frame = requestAnimationFrame(() => load(true));
    const storage = (event: StorageEvent) => { if (event.key === PROFILE_STORAGE_KEY || event.key === "calendar-app:v1" || event.key === "performance-overview:v1" || event.key === null) load(false); };
    const focus = () => load(false);
    window.addEventListener("storage", storage); window.addEventListener("focus", focus);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("storage", storage); window.removeEventListener("focus", focus); photoRequest.current++; };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 4000); return () => clearTimeout(timer); }, [toast]);
  const ready = !!profile && !!details && !!now;
  const role = calendar?.role ?? "player";
  const dirty = ready && (profile.name !== details.name || profile.nickname !== details.nickname || profile.faceit !== details.faceit || profile.photo !== details.photo);
  useEffect(() => { dirtyRef.current = !!dirty; }, [dirty]);
  const billing = profile ? billingFor(profile) : null;
  const access = billing && now ? accessSummary(billing, now) : null;
  const firstPeriod = access?.entries[0]?.period;
  const subscription = firstPeriod && now ? periodState(firstPeriod, now) : null;
  const badge = access && access.entries.length > 1 ? `Активно ${access.entries.length} модуля` : access?.expires ? `${access.label} · до ${briefDate(access.expires)}` : "Бесплатный доступ";
  const persist = (next: ProfileStore) => { try { writeProfile(next); setProfile(next); setSaveError(""); return true; } catch { setSaveError("Не удалось сохранить данные. Проверьте свободное место и доступ к хранилищу браузера."); return false; } };
  const changeDetails = (key: "name" | "nickname" | "faceit", value: string) => { setDetails(current => current ? { ...current, [key]: value } : current); setErrors(current => ({ ...current, [key]: "" })); setSaveError(""); };
  const save = (event: FormEvent) => {
    event.preventDefault(); if (!ready || photoBusy) return;
    const problems = validateDetails(details); setErrors(problems);
    const first = Object.keys(problems)[0]; if (first) { document.getElementById(`profile-${first}`)?.focus(); return; }
    const next = { ...profile, name: details.name.trim(), nickname: details.nickname.trim(), faceit: details.faceit.trim(), photo: details.photo };
    if (persist(next)) { setDetails({ name: next.name, nickname: next.nickname, faceit: next.faceit, photo: next.photo }); dirtyRef.current = false; setToast("Данные профиля сохранены в этом браузере"); }
  };
  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const request = ++photoRequest.current;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setPhotoBusy(false); setErrors(current => ({ ...current, photo: "Выберите PNG, JPEG или WebP размером до 5 МБ" })); return; }
    setPhotoBusy(true); setErrors(current => ({ ...current, photo: "" }));
    try {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width > 8000 || bitmap.height > 8000 || !bitmap.width || !bitmap.height) throw new Error("dimensions");
        const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
        const context = canvas.getContext("2d"); if (!context) throw new Error("canvas");
        const size = Math.min(bitmap.width, bitmap.height); context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
        const photo = canvas.toDataURL("image/webp", .85);
        if (photoRequest.current === request) setDetails(current => current ? { ...current, photo } : current);
      } finally { bitmap.close(); }
    } catch { if (photoRequest.current === request) setErrors(current => ({ ...current, photo: "Не удалось открыть фото. Попробуйте другой файл до 8000 × 8000 пикселей." })); }
    finally { if (photoRequest.current === request) setPhotoBusy(false); }
  };
  const selectProfile = (kind: ProfileKind) => {
    if (!profile || !profile.memberships.includes(kind)) return;
    if (persist({ ...profile, active: kind })) {
      const next = { ...(calendar ?? readStore()), role: kind === "staff" ? "manager" as const : "player" as const }; setCalendar(next); writeStore(next);
      setToast(`Активный профиль: ${profileLabels[kind]}. Демоданные разделов сохранены.`);
    }
  };
  const join = (event: FormEvent) => {
    event.preventDefault(); if (!profile) return;
    const membership = demoMembership(joinKind, code);
    if (!membership) { setCodeError("Код не найден. Для этой демоверсии используйте код из раздела «Демо-коды»."); return; }
    const next: ProfileStore = { ...profile, memberships: profile.memberships.includes(membership) ? profile.memberships : [...profile.memberships, membership], active: membership };
    if (persist(next)) { const shared = { ...(calendar ?? readStore()), role: membership === "staff" ? "manager" as const : "player" as const }; setCalendar(shared); writeStore(shared); setCode(""); setCodeError(""); setToast("Демопрофиль подключён. Solo-профиль сохранён."); }
  };
  const changePassword = (event: FormEvent) => { event.preventDefault(); const error = validatePasswords(passwords.current, passwords.next, passwords.repeat); setPasswordError(error); if (!error) { setPasswords({ current: "", next: "", repeat: "" }); setDialog("password"); } };
  const closeDialog = () => { if (!logoutBusy) { setDialog(null); setDeleteName(""); setLogoutError(""); } };
  const openPlans = () => router.push("/plans");
  const logout = async () => { setLogoutBusy(true); setLogoutError(""); try { const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); if (!response.ok) throw new Error("logout"); router.replace("/?screen=login"); } catch { setLogoutError("Не удалось выйти из аккаунта. Проверьте соединение и попробуйте ещё раз."); } finally { setLogoutBusy(false); } };
  const resetDemo = () => {
    if (!ready || deleteName !== profile.nickname) return;
    const fresh = initialProfile(now);
    if (persist(fresh)) { setDetails({ name: fresh.name, nickname: fresh.nickname, faceit: fresh.faceit, photo: fresh.photo }); const next = { ...(calendar ?? readStore()), role: "player" as const }; setCalendar(next); writeStore(next); dirtyRef.current = false; closeDialog(); setErrors({}); setToast("Демопрофиль сброшен. Календарь, тесты и записи статистики сохранены."); }
  };
  const switchRole = () => { const next = { ...(calendar ?? readStore()), role: role === "player" ? "manager" as const : "player" as const }; setCalendar(next); writeStore(next); };

  return <main className={shell.app} aria-busy={!ready}>
    <header className={shell.mobileHeader}><div className={shell.brandMark}><Icon name="logo" size={25}/></div><strong>Performance CRM</strong><button className={shell.iconButton} onClick={() => setMobileMenu(value => !value)} aria-label={mobileMenu ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileMenu}><Icon name={mobileMenu ? "close" : "menu"}/></button></header>
    {mobileMenu && <button className={shell.menuBackdrop} aria-label="Закрыть меню" onClick={() => setMobileMenu(false)}/>}
    <CrmSidebar active="profile" role={role} mobileOpen={mobileMenu} onClose={() => setMobileMenu(false)} onSwitchRole={switchRole} onSettings={() => setDialog("settings")} onSection={section => section === "plans" ? openPlans() : router.push(`/overview?section=${section}`)}/>
    <section className={`${shell.workspace} ${styles.workspace}`}>
      <header className={styles.header}><h1>Профиль</h1><div className={styles.toolbar}><button className={styles.pill} onClick={openPlans}>{badge}</button><button className={shell.activityButton} aria-label={`Серия: ${overview && now ? streakDays(overview, now) : 0} дней`} onClick={() => setDialog("streak")}><Icon name="fire" size={20}/><strong>{overview && now ? streakDays(overview, now) : "—"}</strong></button><button className={shell.notificationButton} onClick={() => setDialog("notifications")} aria-label={`Уведомления: ${calendar?.notifications.filter(item => !item.read).length ?? 0} непрочитанных`}><Icon name="bell" size={22}/>{!!calendar?.notifications.some(item => !item.read) && <span>{Math.min(99, calendar.notifications.filter(item => !item.read).length)}</span>}</button></div></header>
      {ready && access ? <><div className={styles.columns}><div className={styles.column}>
        <section className={styles.card} aria-labelledby="about-title"><h2 id="about-title">О вас</h2><div className={styles.identity}><div className={styles.avatar}>{details.photo ? <Image src={details.photo} alt="Фото профиля" width={98} height={98} unoptimized/> : initials(profile.nickname)}</div><div className={styles.identityInfo}><h3>{profile.nickname}</h3><span className={styles.pill}>{profileLabels[profile.active]}</span><div className={styles.photoButtons}><button className={styles.secondary} onClick={() => photoInput.current?.click()} disabled={photoBusy}>{photoBusy ? "Обработка…" : "Изменить фото"}</button>{details.photo && <button className={styles.secondary} onClick={() => { photoRequest.current++; setPhotoBusy(false); setDetails({ ...details, photo: null }); }}>Убрать фото</button>}</div><input ref={photoInput} className={styles.srOnly} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Выбрать фото профиля" onChange={uploadPhoto} tabIndex={-1}/></div></div>{errors.photo && <p className={styles.error} role="alert">{errors.photo}</p>}
          <form className={styles.form} onSubmit={save} noValidate><div className={styles.pair}>{([{ key: "name", label: "Имя", max: 80 }, { key: "nickname", label: "Никнейм", max: 32 }] as const).map(field => <label className={styles.field} key={field.key}><span>{field.label}</span><input aria-label={field.label} id={`profile-${field.key}`} value={details[field.key]} maxLength={field.max} autoComplete={field.key === "name" ? "given-name" : "nickname"} aria-invalid={!!errors[field.key]} aria-describedby={errors[field.key] ? `profile-error-${field.key}` : undefined} onChange={event => changeDetails(field.key, event.target.value)}/>{errors[field.key] && <span className={styles.error} id={`profile-error-${field.key}`}>{errors[field.key]}</span>}</label>)}</div><div className={styles.field}><span>Email</span><div className={styles.email}><span>{profile.email}</span><span className={styles.pill} title="Пример статуса для демоаккаунта">Подтверждён</span></div></div><label className={styles.field}><span>FACEIT</span><input aria-label="FACEIT" id="profile-faceit" type="url" value={details.faceit} maxLength={500} placeholder="https://www.faceit.com/ru/players/ваш_ник" aria-invalid={!!errors.faceit} aria-describedby={errors.faceit ? "profile-error-faceit" : undefined} onChange={event => changeDetails("faceit", event.target.value)}/>{errors.faceit && <span className={styles.error} id="profile-error-faceit">{errors.faceit}</span>}</label>{saveError && <p className={styles.error} role="alert">{saveError}</p>}<button className={styles.primary} disabled={!dirty || photoBusy} type="submit">Сохранить</button></form>
        </section>
        <section className={styles.card} aria-labelledby="password-title"><h2 id="password-title">Пароль</h2><p>После смены пароля нужно будет войти заново</p><form className={`${styles.form} ${styles.password}`} onSubmit={changePassword} noValidate><label className={styles.field}><span>Текущий пароль</span><input type="password" autoComplete="current-password" maxLength={128} value={passwords.current} onChange={event => { setPasswords({ ...passwords, current: event.target.value }); setPasswordError(""); }}/></label><div className={styles.pair}><label className={styles.field}><span>Новый пароль</span><input type="password" autoComplete="new-password" maxLength={128} value={passwords.next} onChange={event => { setPasswords({ ...passwords, next: event.target.value }); setPasswordError(""); }}/></label><label className={styles.field}><span>Повторите пароль</span><input type="password" autoComplete="new-password" maxLength={128} value={passwords.repeat} onChange={event => { setPasswords({ ...passwords, repeat: event.target.value }); setPasswordError(""); }}/></label></div><span className={styles.hint}>Минимум 8 символов, буквы и цифры</span>{passwordError && <p className={styles.error} role="alert">{passwordError}</p>}<button className={styles.primary} type="submit">Сменить пароль</button></form></section>
        <section className={`${styles.card} ${styles.dangerCard}`} aria-labelledby="delete-title"><h2 id="delete-title">Удаление аккаунта</h2><p>Все данные и история аккаунта удаляются без возможности восстановления</p><button className={styles.danger} onClick={() => { setDeleteName(""); setDialog("delete"); }}>Удалить аккаунт</button></section>
      </div><div className={styles.column}>
        <section className={`${styles.card} ${styles.subscription}`} aria-labelledby="subscription-title"><div className={styles.cardTitle}><h2 id="subscription-title">Подписка</h2><span className={styles.pill}>{access.label}</span></div><span className={styles.muted}>{access.expires ? access.entries.length > 1 ? "Ближайшее окончание" : "Действует до" : "Текущий тариф"}</span><strong className={styles.expires}>{access.expires ? longDate(access.expires) : "Бесплатный"}</strong><div className={styles.progress} role="progressbar" aria-label="Остаток срока демоподписки" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(subscription?.remaining ?? 0)}><span style={{ width: `${subscription?.remaining ?? 0}%` }}/></div><p>{subscription ? subscription.days ? `Осталось ${daysLabel(subscription.days)}${access.entries.length > 1 ? " до ближайшего окончания" : ""} · без автосписаний` : "Доступ заканчивается сегодня" : "Базовые возможности доступны без срока"}</p><div className={styles.actions}>{access.entries.length > 0 && <Link href="/plans#current-access" className={styles.primary}>Продлить</Link>}<button className={styles.secondary} onClick={openPlans}>Сменить тариф</button></div></section>
        <section className={styles.card} aria-labelledby="profiles-title"><h2 id="profiles-title">Профили</h2><p>От активного профиля зависят разделы и данные в приложении</p><div className={styles.memberList} role="group" aria-label="Активный профиль">{profile.memberships.map(kind => <button key={kind} className={`${styles.member} ${profile.active === kind ? styles.memberActive : ""}`} aria-pressed={profile.active === kind} onClick={() => selectProfile(kind)}><span className={styles.radio}/><span><strong>{profileLabels[kind]}</strong><small>{descriptions[kind]}</small></span>{profile.active === kind && <span className={styles.pill}>Активен</span>}</button>)}</div><form className={styles.connect} onSubmit={join} noValidate><h3>Подключить по коду</h3><div className={styles.tabs} role="group" aria-label="Тип кода">{([{ kind: "team", label: "Код команды" }, { kind: "staff", label: "Staff-код" }] as const).map(item => <button key={item.kind} type="button" className={joinKind === item.kind ? styles.tabActive : ""} aria-pressed={joinKind === item.kind} onClick={() => { setJoinKind(item.kind); setCode(""); setCodeError(""); }}>{item.label}</button>)}</div><label className={styles.field} htmlFor="profile-code">{joinKind === "team" ? "Код команды" : "Staff-код"}</label><div className={styles.codeRow}><input className={styles.codeInput} id="profile-code" placeholder={joinKind === "team" ? "Например, AT-7F3K" : "Например, STAFF-7F3K"} maxLength={32} autoComplete="off" spellCheck={false} value={code} aria-invalid={!!codeError} aria-describedby={codeError ? "code-error" : "code-hint"} onChange={event => { setCode(event.target.value); setCodeError(""); }}/><button className={styles.primary} type="submit">Подключить</button></div>{codeError && <p className={styles.error} role="alert" id="code-error">{codeError}</p>}<p className={styles.hint} id="code-hint">Код выдаёт владелец команды. Solo-профиль останется — переключаться можно здесь.</p></form></section>
        <button className={styles.logout} onClick={() => setDialog("logout")}><Icon name="logout" size={18}/> Выйти из аккаунта</button>
      </div></div><div className={styles.demoNote}><span>Демоверсия: данные и фото хранятся в этом браузере. Подписка и подключение профилей — без оплаты и реальных прав доступа.</span><button className={styles.textButton} onClick={() => setDialog("codes")}>Демо-коды</button></div></> : <p role="status">Загрузка профиля…</p>}
    </section>
    {dialog && <Modal title={{ password: "Смена пароля", delete: "Удаление аккаунта", logout: "Выйти из аккаунта?", codes: "Демо-коды профилей", settings: "Настройки профиля", streak: "Серия ежедневных оценок", notifications: "Уведомления" }[dialog]} onClose={closeDialog}><div className={styles.modalBody}>
      {dialog === "password" ? <><h3>Смена пароля пока не подключена</h3><p>Для этого действия нужен защищённый API единого аккаунта. Пароль не изменён. Введённые значения очищены: они не отправлялись на сервер и не сохранялись в браузере.</p><button className={styles.secondary} onClick={closeDialog}>Понятно</button></> : dialog === "delete" ? <><h3>Настоящий аккаунт не будет удалён</h3><p>Удаление единого аккаунта пока не подключено к API. Здесь можно сбросить только демопрофиль: имя, никнейм, фото, профили и демоподписку. История календаря, тестов, восстановления и статистики останется.</p><label className={styles.field}><span>Для сброса введите {profile?.nickname}</span><input className={styles.confirmInput} value={deleteName} onChange={event => setDeleteName(event.target.value)} autoComplete="off"/></label><div className={styles.actions}><button className={styles.secondary} onClick={closeDialog}>Отмена</button><button className={styles.danger} disabled={deleteName !== profile?.nickname} onClick={resetDemo}>Сбросить демопрофиль</button></div></> : dialog === "logout" ? <><p>Сессия входа в CRM будет завершена. Локальные демоданные останутся в браузере.</p>{logoutError && <p className={styles.error} role="alert">{logoutError}</p>}<div className={styles.actions}><button className={styles.secondary} disabled={logoutBusy} onClick={closeDialog}>Отмена</button><button className={styles.primary} disabled={logoutBusy} onClick={logout}>{logoutBusy ? "Выход…" : "Выйти"}</button></div></> : dialog === "codes" ? <><p>Код команды: <strong>AT-7F3K</strong></p><p>Staff-код: <strong>STAFF-7F3K</strong></p><p>Коды работают только в локальной демоверсии. Они не добавляют вас в настоящую команду и не дают доступа к чужим данным.</p></> : dialog === "settings" ? <><p>Измените данные и фото в блоке «О вас», затем нажмите «Сохранить». Изображения PNG, JPEG и WebP до 5 МБ обрезаются по центру и уменьшаются до 256 × 256 пикселей.</p><p>Это демопрофиль, не данные единого аккаунта ScoutScope. Изменения не синхронизируются между устройствами. Подключённые профили меняют режим интерфейса, но пока используют общие локальные демоданные.</p></> : dialog === "streak" ? <><h3>{overview && now ? streakDays(overview, now) : 0} дней подряд</h3><p>Заполняйте все три ежедневные оценки в «Обзоре», чтобы продолжать серию.</p><Link href="/overview" className={styles.primary}>Открыть обзор</Link></> : calendar?.notifications.length ? calendar.notifications.map(item => <Link key={item.id} className={styles.notification} href={item.eventId ? `/calendar?event=${encodeURIComponent(item.eventId)}` : "/calendar"} onClick={() => { const next = { ...calendar, notifications: calendar.notifications.map(entry => entry.id === item.id ? { ...entry, read: true } : entry) }; setCalendar(next); writeStore(next); }}><strong>{item.title}</strong><small>{item.message}</small></Link>) : <p>Новых уведомлений нет.</p>}
      {saveError && <p className={styles.error} role="alert">{saveError}</p>}
    </div></Modal>}
    {toast && <div className={shell.toast} role="status"><span><Icon name="check" size={17}/></span>{toast}</div>}
  </main>;
}
