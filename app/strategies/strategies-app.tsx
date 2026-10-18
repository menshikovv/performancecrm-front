"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CrmIcon as Icon, CrmModal as Modal, CrmSidebar } from "../components/crm-ui";
import { readStore, writeStore } from "../calendar/calendar-data";
import { GameMap, Material, MaterialDraft, MaterialFilters, MaterialType, STRATEGIES_STORAGE_KEY, StrategiesStore, defaultFilters, emptyDraft, filterMaterials, isDirectVideo, maps, materialCount, materialDate, materialFromDraft, materialTypes, readStrategiesStore, toDraft, validateDraft } from "./strategies-data";
import shell from "../calendar/calendar.module.css";
import styles from "./strategies.module.css";

function MaterialIcon({ type, large = false }: { type: MaterialType; large?: boolean }) {
  const size = large ? 58 : 42;
  if (type === "flash") return <Icon name="sun" size={size}/>;
  if (type === "molotov") return <Icon name="fire" size={size}/>;
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type === "smoke" ? <path d="M13 36h23a10 10 0 0 0 1-20 13 13 0 0 0-25-3 12 12 0 0 0 1 23Z"/> : type === "script" ? <><path d="M19 11h23M19 24h23M19 37h23"/><circle cx="7" cy="11" r="1"/><circle cx="7" cy="24" r="1"/><circle cx="7" cy="37" r="1"/></> : <><circle cx="23" cy="29" r="13"/><path d="M20 16V9h12M27 9l9-6M20 16h7"/></>}</svg>;
}
function Preview({ material, large = false }: { material: Material; large?: boolean }) {
  return <div className={`${styles.preview} ${large ? styles.largePreview : ""} ${styles[material.type]}`} data-map={material.map} aria-hidden="true"><span className={`${styles.sideBadge} ${material.side === "CT" ? styles.ct : ""}`}>{material.side}</span><MaterialIcon type={material.type} large={large}/>{!large && (material.video || material.demoVideo) && <span className={styles.videoBadge}><Icon name="play" size={10}/>Видео</span>}</div>;
}
type Editor = { id: string | null; draft: MaterialDraft; initial: string; updatedAt: string | null };

export default function StrategiesApp() {
  const router = useRouter();
  const [store, setStore] = useState<StrategiesStore | null>(null);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [settings, setSettings] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const live = useRef(true);
  editorRef.current = editor;

  useEffect(() => {
    live.current = true;
    const load = (initial = false) => {
      const value = readStrategiesStore();
      if (initial) {
        const requested = new URLSearchParams(location.search).get("material");
        if (requested && requested !== value.selected && value.materials.some(m => m.id === requested)) { value.selected = requested; value.filters = defaultFilters(); }
        try { localStorage.setItem(STRATEGIES_STORAGE_KEY, JSON.stringify(value)); } catch { setError("Локальное сохранение недоступно. Материалы можно просматривать, но изменения не сохранятся."); }
        try { const calendar = readStore(); if (calendar.role !== "manager") writeStore({ ...calendar, role: "manager" }); } catch { setError("Не удалось сохранить деморежим Staff. Материалы доступны для просмотра."); }
      }
      setStore(value);
    };
    const frame = requestAnimationFrame(() => load(true));
    const sync = (event: StorageEvent) => { if (event.key === STRATEGIES_STORAGE_KEY || event.key === null) load(); };
    const focus = () => load();
    const beforeUnload = (event: BeforeUnloadEvent) => { const current = editorRef.current; if (current && JSON.stringify(current.draft) !== current.initial) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("storage", sync); window.addEventListener("focus", focus); window.addEventListener("beforeunload", beforeUnload);
    return () => { live.current = false; cancelAnimationFrame(frame); window.removeEventListener("storage", sync); window.removeEventListener("focus", focus); window.removeEventListener("beforeunload", beforeUnload); };
  }, []);

  const update = (change: (value: StrategiesStore) => StrategiesStore) => {
    try { const next = change(readStrategiesStore()); localStorage.setItem(STRATEGIES_STORAGE_KEY, JSON.stringify(next)); setStore(next); setError(""); return true; }
    catch (cause) { setError(cause instanceof Error && cause.message.startsWith("Материал") ? cause.message : "Не удалось сохранить изменения. Проверьте доступ к хранилищу и свободное место в браузере."); return false; }
  };
  const updateFilters = (change: Partial<MaterialFilters>) => { setMobileDetail(false); update(value => ({ ...value, filters: { ...value.filters, ...change } })); };
  const toggleFavorite = (id: string) => update(value => ({ ...value, materials: value.materials.map(m => m.id === id ? { ...m, favorite: !m.favorite } : m) }));
  const openMaterial = (material: Material) => {
    if (update(value => ({ ...value, selected: material.id }))) {
      if (window.matchMedia("(max-width: 1099px)").matches) setMobileDetail(true);
      const url = new URL(location.href); url.searchParams.set("material", material.id); window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    }
  };
  const openEditor = (type: MaterialType, material?: Material) => {
    const draft = material ? toDraft(material) : emptyDraft(type);
    setEditor({ id: material?.id ?? null, draft, initial: JSON.stringify(draft), updatedAt: material?.updatedAt ?? null }); setFormError(""); setMobileDetail(false); setVideoId(null);
  };
  const closeEditor = () => { if (editor && JSON.stringify(editor.draft) !== editor.initial) setDiscard(true); else setEditor(null); };
  const draftChange = (change: Partial<MaterialDraft>) => { setFormError(""); setEditor(value => value && ({ ...value, draft: { ...value.draft, ...change } })); };
  const saveMaterial = () => {
    if (!editor) return;
    const validation = validateDraft(editor.draft); if (validation) { setFormError(validation); return; }
    const id = editor.id ?? crypto.randomUUID();
    const saved = update(value => {
      const existing = value.materials.find(m => m.id === editor.id);
      if (editor.id && !existing) throw new Error("Материал удалён в другой вкладке. Скопируйте текст и создайте новую запись.");
      if (existing && existing.updatedAt !== editor.updatedAt) throw new Error("Материал изменён в другой вкладке. Скопируйте правки и откройте актуальную версию перед сохранением.");
      if (!existing && value.materials.length >= 500) throw new Error("Материалов уже 500. Удалите ненужные записи перед добавлением новых.");
      const material = materialFromDraft(editor.draft, id, new Date(), existing);
      return { ...value, materials: existing ? value.materials.map(m => m.id === id ? material : m) : [material, ...value.materials], selected: id, filters: defaultFilters() };
    });
    if (saved) { setEditor(null); setAnnouncement(editor.id ? "Изменения сохранены в этом браузере" : "Материал добавлен в командную демобазу"); const url = new URL(location.href); url.searchParams.set("material", id); window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`); }
  };
  const removeMaterial = () => {
    if (!deleteId) return;
    if (update(value => { const materials = value.materials.filter(m => m.id !== deleteId); return { ...value, materials, selected: value.selected === deleteId ? materials[0]?.id ?? null : value.selected }; })) {
      setDeleteId(null); setMobileDetail(false); setAnnouncement("Материал удалён из локальной демобазы"); const url = new URL(location.href); url.searchParams.delete("material"); window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    }
  };
  const switchRole = () => { try { writeStore({ ...readStore(), role: "player" }); router.push("/overview"); } catch { setError("Не удалось переключить деморежим. Проверьте доступ к хранилищу браузера."); } };
  const copyScript = async (script: string) => { try { await navigator.clipboard.writeText(script); if (live.current) setAnnouncement("Текст скопирован"); } catch { if (live.current) setError("Не удалось скопировать текст. Выделите его и скопируйте вручную."); } };

  const materials = store?.materials ?? [];
  const visible = store ? filterMaterials(materials, store.filters) : [];
  const selected = visible.find(m => m.id === store?.selected) ?? visible[0] ?? null;
  const video = materials.find(m => m.id === videoId);
  const deleting = materials.find(m => m.id === deleteId);
  const steps = (material: Material) => <><h3 className={styles.stepsTitle}>{material.type === "script" ? "План действий" : "Как бросать"}</h3><ol className={styles.steps}>{material.steps.map((step, index) => <li key={`${material.id}:${index}`}><button className={material.completed.includes(index) ? styles.completedStep : ""} aria-label={`${material.completed.includes(index) ? "Снять отметку" : "Отметить"}: шаг ${index + 1}`} aria-pressed={material.completed.includes(index)} onClick={() => update(value => ({ ...value, materials: value.materials.map(m => m.id === material.id ? { ...m, completed: m.completed.includes(index) ? m.completed.filter(n => n !== index) : [...m.completed, index] } : m) }))}>{material.completed.includes(index) ? <Icon name="check" size={15}/> : index + 1}</button><span>{step}</span></li>)}</ol>{material.completed.length > 0 && <p className={styles.progressText}>Отмечено {material.completed.length} из {material.steps.length}</p>}</>;
  const details = (material: Material, modal = false) => <>
    <Preview material={material} large/>
    <div className={styles.detailBody}><div className={styles.tags}><span>{materialTypes[material.type]}</span><span>{material.map}</span><span>{material.side === "T" ? "Атака (T)" : "Защита (CT)"}</span></div>{!modal && <h2 id="strategy-detail-title">{material.title}</h2>}{material.description && <p className={styles.description}>{material.description}</p>}
      {(material.video || material.demoVideo) && <button className={styles.primary} onClick={() => { setVideoId(material.id); setMobileDetail(false); }}><Icon name="play" size={13}/>Смотреть видео</button>}
      {steps(material)}
      {material.type === "script" && material.script && <section className={styles.scriptText}><div><h3>Текст скрипта</h3><button onClick={() => copyScript(material.script)}>Копировать</button></div><pre tabIndex={0}>{material.script}</pre><p>Текст хранится как заметка и не выполняется приложением.</p></section>}
      <p className={styles.author}>Добавил {material.author} · {materialDate(material.createdAt)} · видно всем игрокам команды</p><div className={styles.detailActions}><button className={styles.secondary} aria-pressed={material.favorite} onClick={() => toggleFavorite(material.id)}><span className={material.favorite ? styles.favoriteStar : ""}>★</span>{material.favorite ? "В избранном" : "В избранное"}</button><button className={styles.secondary} onClick={() => openEditor(material.type, material)}>Редактировать</button><button className={styles.danger} onClick={() => { setDeleteId(material.id); setMobileDetail(false); }}>Удалить</button></div>
    </div>
  </>;

  return <main className={shell.app} aria-busy={!store}>
    <header className={shell.mobileHeader}><div className={shell.brandMark}><Icon name="logo" size={25}/></div><strong>Performance CRM</strong><button className={shell.iconButton} aria-label={mobile ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobile} onClick={() => setMobile(value => !value)}><Icon name={mobile ? "close" : "menu"}/></button></header>
    {mobile && <button className={shell.menuBackdrop} aria-label="Закрыть меню" onClick={() => setMobile(false)}/>}
    <CrmSidebar active="strategies" role="manager" mobileOpen={mobile} onClose={() => setMobile(false)} onSwitchRole={switchRole} onSettings={() => setSettings(true)} onSection={() => {}}/>
    <section className={`${shell.workspace} ${styles.workspace}`}>
      <header className={styles.header}><div><div className={styles.context}><span>Staff</span>Atlant Esports · база команды, видна всем игрокам</div><h1>Раскидки и скрипты</h1></div><div className={styles.createActions} role="group" aria-label="Добавить материал"><button className={styles.secondary} onClick={() => openEditor("smoke")}><Icon name="plus" size={18}/>Раскидка</button><button className={styles.primary} onClick={() => openEditor("script")}><Icon name="plus" size={18}/>Скрипт</button></div></header>
      {!store ? <p role="status">Загрузка командной базы…</p> : <>
        <div className={styles.stats} aria-label="Сводка командной базы">{[["Всего записей", materials.length], ["Раскидок", materials.filter(m => m.type !== "script").length], ["Скриптов", materials.filter(m => m.type === "script").length], ["В избранном", materials.filter(m => m.favorite).length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.announcement} role="status">{announcement}</p>
        <div className={styles.layout}><div className={styles.catalog}>
          <section className={styles.filterPanel} aria-label="Фильтры материалов"><label className={styles.search}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input type="search" aria-label="Поиск материалов" placeholder="Поиск: название, карта, описание" maxLength={200} value={store.filters.search} onChange={event => updateFilters({ search: event.target.value })}/></label>
            <div className={styles.chips} role="group" aria-label="Фильтр по карте"><button className={store.filters.map === "all" ? styles.active : ""} aria-pressed={store.filters.map === "all"} onClick={() => updateFilters({ map: "all" })}>Все <span>{filterMaterials(materials, { ...store.filters, map: "all" }).length}</span></button>{maps.map(map => <button key={map} className={store.filters.map === map ? styles.active : ""} aria-pressed={store.filters.map === map} onClick={() => updateFilters({ map })}>{map}<span>{filterMaterials(materials, { ...store.filters, map }).length}</span></button>)}</div>
            <div className={styles.chips} role="group" aria-label="Фильтр по типу"><button className={store.filters.type === "all" ? styles.active : ""} aria-pressed={store.filters.type === "all"} onClick={() => updateFilters({ type: "all" })}>Все типы</button>{Object.entries(materialTypes).map(([key, label]) => <button key={key} className={store.filters.type === key ? styles.active : ""} aria-pressed={store.filters.type === key} onClick={() => updateFilters({ type: key as MaterialType })}>{label}</button>)}</div>
            <div className={styles.bottomFilters}><div className={styles.sides} role="group" aria-label="Фильтр по стороне">{([{ key: "all", label: "Обе" }, { key: "T", label: "T" }, { key: "CT", label: "CT" }] as const).map(side => <button key={side.key} className={store.filters.side === side.key ? styles.active : ""} aria-pressed={store.filters.side === side.key} onClick={() => updateFilters({ side: side.key })}>{side.label}</button>)}</div><button className={`${styles.favoriteFilter} ${store.filters.favorites ? styles.favoriteFilterActive : ""}`} aria-pressed={store.filters.favorites} onClick={() => updateFilters({ favorites: !store.filters.favorites })}>★ Избранное</button></div>
          </section>
          <p className={styles.count} aria-live="polite">{materialCount(visible.length)}</p>
          {visible.length ? <div className={styles.cardGrid}>{visible.map(material => <article key={material.id} className={`${styles.card} ${selected?.id === material.id ? styles.selectedCard : ""}`} data-material-id={material.id}><button className={styles.selectCard} aria-label={`Открыть: ${material.title}`} aria-pressed={selected?.id === material.id} onClick={() => openMaterial(material)}><Preview material={material}/><div className={styles.cardBody}><h2>{material.title}</h2><p>{material.map} · {material.side} · {materialTypes[material.type]}</p><span>{material.author} · {materialDate(material.createdAt)}</span></div></button><button className={`${styles.favoriteButton} ${material.favorite ? styles.favoriteStar : ""}`} aria-label={`${material.favorite ? "Убрать из избранного" : "Добавить в избранное"}: ${material.title}`} aria-pressed={material.favorite} onClick={() => toggleFavorite(material.id)}>★</button></article>)}</div> : <div className={styles.empty}><Icon name="strategy" size={38}/><h2>{materials.length ? "Ничего не найдено" : "В базе пока нет материалов"}</h2><p>{materials.length ? "Измените запрос или сбросьте фильтры." : "Добавьте первую раскидку или командный план."}</p><button className={styles.secondary} onClick={() => materials.length ? updateFilters(defaultFilters()) : openEditor("smoke")}>{materials.length ? "Сбросить фильтры" : "Добавить раскидку"}</button></div>}
        </div><aside className={styles.detail} aria-labelledby={selected ? "strategy-detail-title" : undefined} aria-label={selected ? undefined : "Описание материала"}>{selected ? details(selected) : <div className={styles.detailEmpty}><Icon name="strategy" size={42}/><p>Выберите материал из каталога</p></div>}</aside></div>
        <p className={styles.demoNote}>Демобаза: материалы, избранное и отметки шагов сохраняются в этом браузере. Общий доступ команды и права редактирования пока не подключены к серверу.</p>
      </>}
    </section>
    {mobileDetail && selected && <Modal title={selected.title} onClose={() => setMobileDetail(false)}><div className={styles.mobileDetail}>{details(selected, true)}</div></Modal>}
    {video && <Modal title={`Видео · ${video.title}`} onClose={() => setVideoId(null)} wide><div className={styles.videoModal}>{video.video ? isDirectVideo(video.video) ? <video controls preload="none" src={video.video} aria-label={`Видео: ${video.title}`} onError={() => setError("Не удалось загрузить видео. Проверьте ссылку и доступность файла.")}/> : <><Preview material={video} large/><p>Ролик откроется на внешнем видеосервисе.</p><a className={styles.primary} href={video.video} target="_blank" rel="noopener noreferrer"><Icon name="play" size={14}/>Открыть видео</a></> : <><Preview material={video} large/><h3>Демонстрационная видеокарточка</h3><p>Ролик к этому примеру ещё не добавлен. Укажите ссылку при редактировании материала.</p><button className={styles.primary} onClick={() => openEditor(video.type, video)}>Добавить ссылку на видео</button></>}{error && <p className={styles.error} role="alert">{error}</p>}</div></Modal>}
    {editor && !discard && <Modal title={editor.id ? "Редактировать материал" : editor.draft.type === "script" ? "Новый скрипт" : "Новая раскидка"} onClose={closeEditor} wide>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); saveMaterial(); }} noValidate>
        <label className={styles.field}><span>Название</span><input aria-label="Название" value={editor.draft.title} maxLength={120} onChange={event => draftChange({ title: event.target.value })} placeholder="Например, смок в окно с T-спавна"/></label>
        <div className={styles.formRow}>
          <label className={styles.field}><span>Карта</span><select aria-label="Карта" value={editor.draft.map} onChange={event => draftChange({ map: event.target.value as GameMap })}>{maps.map(map => <option key={map}>{map}</option>)}</select></label>
          <label className={styles.field}><span>Тип</span><select aria-label="Тип" value={editor.draft.type} onChange={event => draftChange({ type: event.target.value as MaterialType })}>{Object.entries(materialTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className={styles.field}><span>Сторона</span><select aria-label="Сторона" value={editor.draft.side} onChange={event => draftChange({ side: event.target.value as "T" | "CT" })}><option value="T">Атака · T</option><option value="CT">Защита · CT</option></select></label>
        </div>
        <label className={styles.field}><span>Описание · необязательно</span><textarea aria-label="Описание · необязательно" rows={2} maxLength={2000} value={editor.draft.description} onChange={event => draftChange({ description: event.target.value })}/></label>
        <label className={styles.field}><span>{editor.draft.type === "script" ? "План действий" : "Как бросать"}</span><textarea aria-label={editor.draft.type === "script" ? "План действий" : "Как бросать"} aria-describedby="strategy-steps-help" rows={5} maxLength={6019} value={editor.draft.steps} onChange={event => draftChange({ steps: event.target.value })} placeholder="Один шаг — одна строка"/><small id="strategy-steps-help">От 1 до 20 шагов, до 300 символов в каждом</small></label>
        {editor.draft.type === "script" && <label className={styles.field}><span>Текст скрипта · необязательно</span><textarea aria-label="Текст скрипта · необязательно" aria-describedby="strategy-script-help" rows={5} maxLength={10000} value={editor.draft.script} onChange={event => draftChange({ script: event.target.value })} placeholder="Заметки, роли или текст конфигурации"/><small id="strategy-script-help">Приложение не запускает команды и не создаёт исполняемые файлы</small></label>}
        <label className={styles.field}><span>Ссылка на видео · необязательно</span><input aria-label="Ссылка на видео · необязательно" aria-describedby="strategy-video-help" type="url" maxLength={2000} value={editor.draft.video} onChange={event => draftChange({ video: event.target.value })} placeholder="https://…"/><small id="strategy-video-help">YouTube, Rutube или прямая ссылка на MP4 / WebM / OGV</small></label>
        {formError && <p className={styles.error} role="alert">{formError}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.formActions}><button type="button" className={styles.secondary} onClick={closeEditor}>Отмена</button><button type="submit" className={styles.primary}>Сохранить материал</button></div>
      </form>
    </Modal>}
    {discard && <Modal title="Не сохранять изменения?" onClose={() => setDiscard(false)}><div className={styles.confirm}><p>Введённый текст будет потерян. Сохранённые материалы останутся без изменений.</p><div className={styles.formActions}><button className={styles.secondary} onClick={() => setDiscard(false)}>Продолжить редактирование</button><button className={styles.danger} onClick={() => { setDiscard(false); setEditor(null); }}>Не сохранять</button></div></div></Modal>}
    {deleteId && <Modal title="Удалить материал?" onClose={() => setDeleteId(null)}><div className={styles.confirm}><p>{deleting ? `«${deleting.title}» будет удалён из локальной демобазы вместе с отметками шагов и избранным.` : "Этот материал уже удалён в другой вкладке."} Остальные записи останутся без изменений.</p><div className={styles.formActions}><button className={styles.secondary} onClick={() => setDeleteId(null)}>Отмена</button><button className={styles.danger} onClick={removeMaterial}>Удалить материал</button></div>{error && <p className={styles.error} role="alert">{error}</p>}</div></Modal>}
    {settings && <Modal title="Командная база материалов" onClose={() => setSettings(false)}><div className={styles.confirm}><p>Поиск, фильтры и избранное помогают найти нужную раскидку. Нажмите на карточку, чтобы открыть шаги; номера шагов можно отмечать по мере подготовки.</p><p>Раскидки и скрипты — локальные примеры. Видимость для команды, авторство и роль Staff пока демонстрационные. Настоящие видео не загружаются автоматически; ссылки добавляются вручную.</p><p>Данные остаются в этом браузере. Общая база команды и серверные права доступа требуют подключения бэкенда.</p></div></Modal>}
  </main>;
}
