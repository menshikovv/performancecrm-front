"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CrmIcon as Icon } from "../components/crm-ui";
import shell from "../calendar/calendar.module.css";
import styles from "./tests.module.css";
import { Attempt, Outcome, TestKey, statusLabels, tests } from "./tests-data";

const random = (length: number) => Math.floor(Math.random() * length);
function outcome(answers: Array<{ correct: boolean; ms: number }>): Outcome {
  const correct = answers.filter(item => item.correct);
  return { correct: correct.length, total: answers.length, reactionMs: correct.length ? Math.round(correct.reduce((sum, item) => sum + item.ms, 0) / correct.length) : null };
}
type GameProps = { onComplete: (result: Outcome) => void };
function VisualGame({ onComplete }: GameProps) {
  const [targets] = useState(() => Array.from({ length: 8 }, () => random(20)));
  const [answers, setAnswers] = useState<Array<{ correct: boolean; ms: number }>>([]);
  const started = useRef(0);
  useEffect(() => { started.current = performance.now(); }, [answers.length]);
  const answer = useCallback((index: number) => {
    const next = [...answers, { correct: index === targets[answers.length], ms: performance.now() - started.current }];
    if (next.length === targets.length) onComplete(outcome(next)); else setAnswers(next);
  }, [answers, targets, onComplete]);
  return <div className={styles.gameStage}><div className={styles.roundLabel}>Раунд {answers.length + 1} / {targets.length}</div><h3>Найдите букву F</h3><p>Нажмите на F среди похожих букв E.</p><div className={styles.searchGrid}>{Array.from({ length: 20 }, (_, index) => <button key={index} onClick={() => answer(index)}>{index === targets[answers.length] ? "F" : "E"}</button>)}</div></div>;
}

function TimedGame({ kind, onComplete }: GameProps & { kind: "go" | "back" }) {
  const [trials] = useState(() => {
    if (kind === "go") return Array.from({ length: 12 }, (_, index) => ({ symbol: "", match: index % 3 !== 1 }));
    const symbols: string[] = [];
    for (let index = 0; index < 16; index++) symbols.push(index > 1 && index % 3 === 2 ? symbols[index - 2] : ["А", "К", "М", "Р"][random(4)]);
    return symbols.map((symbol, index) => ({ symbol, match: index > 1 && symbol === symbols[index - 2] }));
  });
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const answers = useRef<Array<{ correct: boolean; ms: number }>>([]);
  const response = useRef<boolean | null>(null);
  const reaction = useRef(0);
  const started = useRef(0);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    started.current = performance.now();
    const timer = window.setTimeout(() => {
      if (kind === "go" || index > 1) {
        const correct = kind === "go" ? trials[index].match ? response.current === true : response.current === null : response.current === trials[index].match;
        answers.current.push({ correct, ms: response.current === null ? kind === "go" && correct ? 0 : 1800 : reaction.current });
      }
      if (index === trials.length - 1) {
        const result = outcome(answers.current);
        const reacted = answers.current.filter(item => item.correct && item.ms > 0);
        completeRef.current({ ...result, reactionMs: reacted.length ? Math.round(reacted.reduce((sum, item) => sum + item.ms, 0) / reacted.length) : null });
      } else {
        response.current = null; reaction.current = 0; setAnswered(false); setIndex(value => value + 1);
      }
    }, kind === "go" ? 1200 : 2200);
    return () => clearTimeout(timer);
  }, [index, kind, trials]);
  const respond = useCallback((value: boolean) => {
    if (response.current !== null || (kind === "back" && index < 2)) return;
    response.current = value; reaction.current = performance.now() - started.current; setAnswered(true);
  }, [kind, index]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (kind === "go" && event.code === "Space") { event.preventDefault(); respond(true); }
      if (kind === "back" && ["KeyF", "KeyJ"].includes(event.code)) { event.preventDefault(); respond(event.code === "KeyF"); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [kind, respond]);
  const current = trials[index];
  return <div className={styles.gameStage}><div className={styles.roundLabel}>Сигнал {index + 1} / {trials.length}</div><h3>{kind === "go" ? "Реагируйте на синий круг" : index < 2 ? "Запомните символ" : "Совпадает с символом два шага назад?"}</h3>{kind === "go" ? <div className={`${styles.signal} ${current.match ? styles.signalGo : styles.signalStop}`} role="status">{current.match ? "НАЖМИТЕ" : "НЕ НАЖИМАЙТЕ"}</div> : <div className={styles.memorySymbol} role="status" aria-label={`Символ ${current.symbol}`}>{current.symbol}</div>}{kind === "go" ? <button className={`${shell.primaryButton} ${styles.responseButton}`} onClick={() => respond(true)} disabled={answered}>Нажать · пробел</button> : <div className={styles.responsePair}><button className={shell.primaryButton} onClick={() => respond(true)} disabled={answered || index < 2}>Совпадает · F</button><button className={shell.secondaryButton} onClick={() => respond(false)} disabled={answered || index < 2}>Не совпадает · J</button></div>}<p className={styles.answerHint}>{answered ? "Ответ принят. Следующий сигнал появится автоматически." : kind === "back" && index < 2 ? "Первые два символа нужно только запомнить." : "Дождитесь следующего сигнала после ответа."}</p></div>;
}

const colors = [{ name: "Красный", hex: "#ff656e" }, { name: "Синий", hex: "#36bbff" }, { name: "Зелёный", hex: "#50dfaa" }, { name: "Жёлтый", hex: "#ffd46c" }];
function StroopGame({ onComplete }: GameProps) {
  const [trials] = useState(() => Array.from({ length: 10 }, (_, index) => ({ word: random(4), ink: random(4), rule: index % 3 === 2 ? "word" : "ink" })));
  const [answers, setAnswers] = useState<Array<{ correct: boolean; ms: number }>>([]);
  const started = useRef(0);
  useEffect(() => { started.current = performance.now(); }, [answers.length]);
  const current = trials[answers.length];
  const answer = useCallback((value: number) => {
    const next = [...answers, { correct: value === (current.rule === "word" ? current.word : current.ink), ms: performance.now() - started.current }];
    if (next.length === trials.length) onComplete(outcome(next)); else setAnswers(next);
  }, [answers, current, onComplete, trials.length]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (!event.repeat && /^[1-4]$/.test(event.key)) { event.preventDefault(); answer(Number(event.key) - 1); } };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, [answer]);
  return <div className={styles.gameStage}><div className={styles.roundLabel}>Раунд {answers.length + 1} / {trials.length}</div><h3>{current.rule === "ink" ? "Выберите цвет текста" : "Выберите значение слова"}</h3><div className={styles.stroopWord} style={{ color: colors[current.ink].hex }}>{colors[current.word].name}</div><div className={styles.colorChoices}>{colors.map((color, index) => <button key={color.name} onClick={() => answer(index)}><i style={{ background: color.hex }}/>{color.name}<small>{index + 1}</small></button>)}</div><p role="status">{answers.length ? answers.at(-1)!.correct ? "Предыдущий ответ верный. " : "В предыдущем ответе была ошибка. " : ""}Правило может меняться — проверяйте подсказку над словом.</p></div>;
}

function SpanGame({ onComplete }: GameProps) {
  const [sequences] = useState(() => [3, 4, 5].map(length => Array.from({ length }, () => random(9))));
  const [round, setRound] = useState(0);
  const [flash, setFlash] = useState(0);
  const [showing, setShowing] = useState(true);
  const [input, setInput] = useState<number[]>([]);
  const [roundResults, setRoundResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const sequence = sequences[round];
  useEffect(() => {
    if (!showing) return;
    const timer = window.setTimeout(() => { if (flash === sequence.length * 2 - 1) setShowing(false); else setFlash(value => value + 1); }, 450);
    return () => clearTimeout(timer);
  }, [showing, flash, sequence]);
  const answer = useCallback((index: number) => {
    if (showing || feedback !== null) return;
    const next = [...input, index]; setInput(next);
    if (next.length === sequence.length) setFeedback(next.every((value, itemIndex) => value === sequence[itemIndex]));
  }, [showing, feedback, input, sequence]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (!event.repeat && /^[1-9]$/.test(event.key)) { event.preventDefault(); answer(Number(event.key) - 1); } };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, [answer]);
  const nextRound = () => {
    const results = [...roundResults, feedback === true];
    if (round === sequences.length - 1) { onComplete({ correct: results.filter(Boolean).length, total: results.length, reactionMs: null }); return; }
    setRoundResults(results); setRound(value => value + 1); setFlash(0); setShowing(true); setInput([]); setFeedback(null);
  };
  const lit = showing && flash % 2 === 0 ? sequence[Math.floor(flash / 2)] : null;
  return <div className={styles.gameStage}><div className={styles.roundLabel}>Последовательность {round + 1} / {sequences.length}</div><h3>{showing ? "Запомните порядок клеток" : feedback !== null ? feedback ? "Верно!" : "Последовательность не совпала" : "Повторите последовательность"}</h3><p>{sequence.length} клетки · {showing ? "Смотрите на подсветку" : `Введено ${input.length} из ${sequence.length}`}</p><div className={styles.spanGrid}>{Array.from({ length: 9 }, (_, index) => <button key={index} className={lit === index ? styles.cellLit : ""} aria-label={`Клетка ${index + 1}`} aria-current={lit === index ? "true" : undefined} disabled={showing || feedback !== null} onClick={() => answer(index)}>{index + 1}</button>)}</div>{feedback !== null && <button className={shell.primaryButton} onClick={nextRound}>{round === sequences.length - 1 ? "Показать результат" : "Следующая последовательность"}</button>}</div>;
}

export default function CognitivePlayer({ queue, onSave, onClose }: { queue: TestKey[]; onSave: (key: TestKey, result: Outcome) => Attempt; onClose: () => void }) {
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<"instructions" | "playing" | "result">("instructions");
  const [result, setResult] = useState<Attempt | null>(null);
  const [sessionResults, setSessionResults] = useState<Attempt[]>([]);
  const test = tests.find(item => item.key === queue[position])!;
  const finish = (value: Outcome) => { const attempt = onSave(test.key, value); setResult(attempt); setSessionResults(current => [...current, attempt]); setPhase("result"); };
  const next = () => { if (position === queue.length - 1) onClose(); else { setPosition(value => value + 1); setPhase("instructions"); setResult(null); } };
  return <div className={styles.playerBody} data-motion="off"><div className={styles.playerProgress}><span>Тест {position + 1} из {queue.length}</span><strong>{test.name}</strong><div><i style={{ width: `${(position + (phase === "result" ? 1 : 0)) / queue.length * 100}%` }}/></div></div>
      {phase === "instructions" && <div className={styles.instructions}><span className={styles.gameIcon}><Icon name={test.key === "span" || test.key === "visual" ? "grid" : "energy"} size={32}/></span><h3>{test.name}</h3><p>{test.instruction}</p><div className={styles.instructionNote}>Точность важнее скорости. На первом знакомстве с тестом результаты могут отличаться от обычных.</div><button className={shell.primaryButton} onClick={() => setPhase("playing")}><Icon name="play" size={16}/> Начать тест</button></div>}
      {phase === "playing" && <div key={test.key}>{test.key === "visual" ? <VisualGame onComplete={finish}/> : test.key === "go" || test.key === "back" ? <TimedGame kind={test.key} onComplete={finish}/> : test.key === "stroop" ? <StroopGame onComplete={finish}/> : <SpanGame onComplete={finish}/>}</div>}
      {phase === "result" && result && <div className={styles.resultScreen}><span className={`${styles.statusBadge} ${styles[result.status]}`}>{statusLabels[result.status]}</span><h3>{test.name} завершён</h3><strong className={styles.resultScore}>{result.score}<small>/100</small></strong><div className={styles.resultStats}><span>Точность<strong>{Math.round(result.correct / result.total * 100)}%</strong></span><span>Верных ответов<strong>{result.correct} / {result.total}</strong></span>{result.reactionMs !== null && <span>Средняя реакция<strong>{result.reactionMs} мс</strong></span>}</div><p>{result.status === "excluded" ? "Точность ниже 60%. Попытка сохранена в истории, но не учитывается в индексе." : result.status === "calibration" ? "Система знакомится с вашим базовым уровнем. Первые две успешные попытки не входят в индекс." : "Результат сохранён и учтён в индексе формы."}</p>{position === queue.length - 1 && sessionResults.length > 1 && <p>Завершено тестов за этот запуск: {sessionResults.length}.</p>}<button className={shell.primaryButton} onClick={next}>{position === queue.length - 1 ? "Готово" : "Следующий тест"}</button></div>}
      {phase !== "result" && <><button className={styles.exitTest} onClick={onClose}>Завершить позже</button>{phase === "playing" && <p className={styles.exitNote}>Завершённые тесты сохранены. Текущий тест при выходе потребуется пройти заново.</p>}</>}
  </div>;
}
