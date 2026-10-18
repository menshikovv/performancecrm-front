"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type Screen = "register" | "login";
type AccessMode = "personal" | "team";
type Role = "player" | "staff";

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function PasswordField({ name, placeholder, autoComplete }: { name: string; placeholder: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return <label className={styles.inputWrap}><input name={name} type={visible ? "text" : "password"} placeholder={placeholder} required autoComplete={autoComplete} /><button className={styles.eyeButton} type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Скрыть пароль" : "Показать пароль"}><EyeIcon /></button></label>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("register");
  const [access, setAccess] = useState<AccessMode>("personal");
  const [role, setRole] = useState<Role>("player");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => { if (new URLSearchParams(window.location.search).get("screen") === "login") setScreen("login"); }); return () => cancelAnimationFrame(frame); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (screen === "register" && password !== String(form.get("passwordRepeat") ?? "")) {
      setMessage({ kind: "error", text: "Пароли не совпадают" });
      return;
    }
    setLoading(true);
    setMessage(null);
    const payload = screen === "login"
      ? { loginOrEmail: form.get("loginOrEmail"), password }
      : {
          name: form.get("name"), email: form.get("email"), password, access,
          role: access === "team" ? role : null,
          faceit: form.get("faceit") || null,
          teamCode: form.get("teamCode") || null,
        };
    try {
      const response = await fetch(`/api/auth/${screen}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok) {
        const detail = result.error?.message ?? result.detail;
        throw new Error(detail || "Не удалось выполнить запрос");
      }
      setMessage({ kind: "success", text: screen === "login" ? `С возвращением, ${result.user.name}!` : "Аккаунт успешно создан." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Сервер недоступен" });
    } finally {
      setLoading(false);
    }
  };

  const isTeamPlayer = access === "team" && role === "player";
  const needsFaceit = access === "personal" || isTeamPlayer;

  return (
    <main className={styles.page}>
      <div className={styles.overlay} />
      <section className={styles.hero} aria-label="Performance CRM">
        <div className={styles.brandSide}>
          <div className={styles.tagline}><p>Аналитика.<br />Прогресс.<br /><strong>Победа.</strong></p><span>Всё для развития игроков и команд в одном месте.</span></div>
        </div>
        <section className={styles.authCard} aria-label={screen === "register" ? "Регистрация" : "Вход"}>
          <h1 className={screen === "register" ? styles.registerTitle : undefined}>{screen === "register" ? "Регистрация" : "С возвращением!"}</h1>
          <form className={styles.form} onSubmit={submit}>
            {screen === "register" ? <>
              <div className={styles.modeSwitch}><button type="button" className={access === "personal" ? styles.selected : ""} onClick={() => setAccess("personal")}>Соло</button><button type="button" className={access === "team" ? styles.selected : ""} onClick={() => setAccess("team")}>Командный доступ</button></div>
              {access === "team" && <label className={styles.selectWrap}><select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Выберите роль"><option value="player">Я игрок</option><option value="staff">Я стафф</option></select></label>}
              <input name="name" placeholder="Имя" required autoComplete="name" />
              <input name="email" type="email" placeholder="Email" required autoComplete="email" />
              <PasswordField name="password" placeholder="Пароль" autoComplete="new-password" />
              <PasswordField name="passwordRepeat" placeholder="Повторите пароль" autoComplete="new-password" />
              {needsFaceit && <input name="faceit" type="url" placeholder="Ссылка Faceit" required />}
              {access === "team" && <><input name="teamCode" placeholder="Код команды" required={isTeamPlayer} /></>}
              <button className={styles.submitButton} type="submit">{loading ? "Создаём…" : "Создать аккаунт"}</button>
              <p className={styles.authLink}>Уже есть аккаунт? <button type="button" onClick={() => { setScreen("login"); setMessage(null); }}>Войти</button></p>
              <div className={styles.agreements}><label><input type="checkbox" required /> <span>Я принимаю условия <a href="/terms">Пользовательского соглашения</a></span></label><label><input type="checkbox" required /> <span>Я принимаю <a href="/privacy">политику конфиденциальности</a></span></label></div>
            </> : <>
              <input name="loginOrEmail" type="text" placeholder="Логин или Email" required autoComplete="username" />
              <PasswordField name="password" placeholder="Пароль" autoComplete="current-password" />
              <button type="button" className={styles.forgotPassword}>Забыли пароль?</button>
              <button className={styles.submitButton} type="submit">{loading ? "Входим…" : "Войти"}</button>
              <p className={styles.authLink}>У меня нет аккаунта <button type="button" onClick={() => { setScreen("register"); setMessage(null); }}>Зарегистрироваться</button></p>
            </>}
            {message && <p role="alert" className={message.kind === "error" ? styles.error : styles.success}>{message.text}</p>}
          </form>
        </section>
      </section>
    </main>
  );
}
