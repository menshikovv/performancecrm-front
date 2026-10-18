"use client";

import { useId, useState } from "react";
import { mean, parseDate } from "../overview/overview-data";
import { calories, duration } from "../recovery/recovery-data";
import { balanceLabels } from "../tests/tests-data";
import { DayStats, Pair, RecoveryMetric } from "./stats-data";
import styles from "./stats.module.css";

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const labelDate = (date: string) => shortDate.format(parseDate(date)).replace(/\./g, "");
export function aggregateChartRows(rows: DayStats[]) {
  if (rows.length <= 90) return rows;
  const grouped: DayStats[] = [];
  for (let index = 0; index < rows.length; index += 7) {
    const part = rows.slice(index, index + 7), day = { ...part[0] };
    (Object.keys(day) as Array<keyof DayStats>).forEach(key => { if (key === "date") return; const values = part.flatMap(item => item[key] === null ? [] : [item[key]!]); day[key] = values.length ? mean(values) : null; });
    grouped.push(day);
  }
  return grouped;
}
function labels(rows: DayStats[]) { const indices = [...new Set([0, ...Array.from({ length: 4 }, (_, i) => Math.round((i + 1) * (rows.length - 1) / 5)), rows.length - 1])]; return indices.filter(index => index >= 0).map(index => ({ index, label: labelDate(rows[index].date) })); }
function segments(rows: DayStats[], key: "mood" | "energy", x: (i: number) => number, y: (v: number) => number) {
  const paths: Array<Array<[number, number]>> = [];
  rows.forEach((row, index) => { if (row[key] === null) return; if (index === 0 || rows[index - 1][key] === null) paths.push([]); paths.at(-1)!.push([x(index), y(row[key]!)]); });
  return paths;
}
export function MoodChart({ rows, moodVisible, energyVisible }: { rows: DayStats[]; moodVisible: boolean; energyVisible: boolean }) {
  const id = useId().replaceAll(":", "");
  const [active, setActive] = useState<number | null>(null);
  const x = (i: number) => rows.length === 1 ? 480 : 48 + i * 858 / Math.max(1, rows.length - 1);
  const y = (v: number) => 238 - v * 21;
  const step = (key: string) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return; setActive(value => key === "Home" ? 0 : key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, (value ?? 0) + (key === "ArrowLeft" ? -1 : 1)))); };
  return <div className={styles.chartScroll}><div className={styles.lineChart} tabIndex={0} role="group" aria-label="График настроения и энергии. Используйте стрелки для просмотра значений." onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); step(event.key); } }} onBlur={() => setActive(null)}>
    <svg viewBox="0 0 930 285" preserveAspectRatio="none" aria-hidden="true" onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const relative = (event.clientX - rect.left) / rect.width * 930; setActive(Math.max(0, Math.min(rows.length - 1, Math.round((relative - 48) / 858 * (rows.length - 1))))); }} onPointerLeave={() => setActive(null)}>
      <defs><linearGradient id={`mood-area-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#29cfff" stopOpacity=".18"/><stop offset="100%" stopColor="#29cfff" stopOpacity="0"/></linearGradient></defs>
      {[0, 2, 4, 6, 8, 10].map(value => <g key={value}><line x1="48" x2="906" y1={y(value)} y2={y(value)} stroke="#26314b"/><text x="30" y={y(value) + 4} textAnchor="end" className={styles.axisLabel}>{value}</text></g>)}
      {moodVisible && segments(rows, "mood", x, y).map((points, index) => { const path = points.map(([a, b], i) => `${i ? "L" : "M"}${a},${b}`).join(" "); return <g key={index}><path d={`${path} L${points.at(-1)![0]},238 L${points[0][0]},238 Z`} fill={`url(#mood-area-${id})`}/><path d={path} fill="none" stroke="#2bd1ff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>{points.length === 1 && <circle cx={points[0][0]} cy={points[0][1]} r="3.5" fill="#2bd1ff"/>}</g>; })}
      {energyVisible && segments(rows, "energy", x, y).map((points, index) => <path key={index} d={points.map(([a, b], i) => `${i ? "L" : "M"}${a},${b}`).join(" ")} fill="none" stroke="#ffac30" strokeWidth="2.8" strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round"/>)}
      {active !== null && rows[active] && <g><line x1={x(active)} x2={x(active)} y1="28" y2="238" stroke="#7698b8" strokeDasharray="4 5"/>{moodVisible && rows[active].mood !== null && <circle cx={x(active)} cy={y(rows[active].mood!)} r="4" fill="#2bd1ff" stroke="#0d1425" strokeWidth="2"/>}{energyVisible && rows[active].energy !== null && <circle cx={x(active)} cy={y(rows[active].energy!)} r="4" fill="#ffac30" stroke="#0d1425" strokeWidth="2"/>}</g>}
      {labels(rows).map(label => <text key={label.index} x={x(label.index)} y="274" textAnchor={label.index === 0 ? "start" : label.index === rows.length - 1 ? "end" : "middle"} className={styles.axisLabel}>{label.label}</text>)}
    </svg>
    {active !== null && rows[active] && <div className={styles.chartTooltip} role="status"><strong>{labelDate(rows[active].date)}</strong>{moodVisible && <span>Настроение: {rows[active].mood?.toFixed(1) ?? "нет записи"}</span>}{energyVisible && <span>Энергия: {rows[active].energy?.toFixed(1) ?? "нет записи"}</span>}</div>}
    {!moodVisible && !energyVisible && <div className={styles.chartEmpty}>Выберите показатель в легенде, чтобы увидеть график.</div>}
  </div></div>;
}

export function LifestyleChart({ rows, metric, target }: { rows: DayStats[]; metric: RecoveryMetric; target: number }) {
  const [active, setActive] = useState<number | null>(null);
  const maximum = Math.max(metric === "nutrition" ? 3000 : 10, ...rows.map(row => row[metric] ?? 0), target) * 1.06;
  const x = (i: number) => 50 + (i + .5) * 855 / Math.max(1, rows.length), y = (value: number) => 221 - value / maximum * 190;
  const format = (value: number) => metric === "nutrition" ? `${calories(value)} ккал` : duration(value * 60);
  return <div className={styles.chartScroll}><div className={styles.barChart}><svg viewBox="0 0 930 270" preserveAspectRatio="none" role="img" aria-label={`График ${metric === "sleep" ? "сна" : metric === "screen" ? "экранного времени" : "питания"}`}>
    <defs><linearGradient id={`lifestyle-${metric}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00bdf1"/><stop offset="100%" stopColor="#0064ff"/></linearGradient><pattern id={`missing-${metric}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#8b502f" strokeWidth="3"/></pattern></defs>
    {[0, maximum / 2, maximum].map((value, index) => <g key={index}><line x1="48" x2="906" y1={y(value)} y2={y(value)} stroke="#25314a"/><text x="32" y={y(value) + 4} textAnchor="end" className={styles.axisLabel}>{metric === "nutrition" ? calories(value) : `${Number(value.toFixed(0))} ч`}</text></g>)}
    {rows.map((row, index) => <g key={row.date} onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)} tabIndex={0} role="img" aria-label={`${labelDate(row.date)}: ${row[metric] === null ? "нет записи" : format(row[metric]!)}`} onFocus={() => setActive(index)} onBlur={() => setActive(null)}><rect x={x(index) - Math.max(2, 855 / rows.length * .31)} y={row[metric] === null ? 199 : y(row[metric]!)} width={Math.max(4, 855 / rows.length * .62)} height={row[metric] === null ? 22 : Math.max(1, 221 - y(row[metric]!))} fill={row[metric] === null ? `url(#missing-${metric})` : `url(#lifestyle-${metric})`} opacity={active === null || active === index ? 1 : .65}/><rect x={x(index) - 855 / rows.length * .48} y="25" width={855 / rows.length * .96} height="200" fill="transparent"/></g>)}
    <line x1="48" x2="906" y1={y(target)} y2={y(target)} stroke="#ffb833" strokeWidth="2" strokeDasharray="7 6" pointerEvents="none"/>
    {labels(rows).map(label => <text key={label.index} x={x(label.index)} y="259" textAnchor={label.index === 0 ? "start" : label.index === rows.length - 1 ? "end" : "middle"} className={styles.axisLabel}>{label.label}</text>)}
  </svg>{active !== null && rows[active] && <div className={styles.chartTooltip} role="status"><strong>{labelDate(rows[active].date)}</strong><span>{rows[active][metric] === null ? "Нет записи" : format(rows[active][metric]!)}</span></div>}</div></div>;
}

export function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (!points.length) return <div className={styles.emptySpark}>Нет зачётных попыток</div>;
  const values = points.length > 40 ? Array.from({ length: 20 }, (_, index) => mean(points.slice(Math.floor(index * points.length / 20), Math.floor((index + 1) * points.length / 20)))) : points;
  const low = Math.min(...values) - 3, high = Math.max(...values) + 3;
  const coords = values.map((value, index) => [values.length === 1 ? 150 : 5 + index * 290 / (values.length - 1), 75 - (value - low) / (high - low) * 65]);
  return <svg className={styles.spark} viewBox="0 0 300 85" role="img" aria-label={`Результаты: ${values.map(value => value.toFixed(1)).join(", ")}`}><line x1="0" x2="300" y1="84" y2="84" stroke="#28334b"/><path d={coords.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ")} fill="none" stroke={color} strokeWidth="2.3" strokeLinejoin="round"/>{coords.length === 1 && <circle cx="150" cy={coords[0][1]} r="4" fill={color}/>}</svg>;
}

export function BalanceRadar({ current, previous }: { current: number[] | null; previous: number[] | null }) {
  const [showCurrent, setShowCurrent] = useState(true), [showPrevious, setShowPrevious] = useState(true);
  const point = (index: number, radius: number) => { const angle = index * Math.PI / 4 - Math.PI / 2; return [180 + Math.cos(angle) * radius, 150 + Math.sin(angle) * radius]; };
  return <div className={styles.balanceVisual}><div className={styles.radarLegend}><button aria-pressed={showCurrent} onClick={() => setShowCurrent(value => !value)}><i/>Этот период</button><button aria-pressed={showPrevious} onClick={() => setShowPrevious(value => !value)}><i/>Предыдущий</button></div><svg viewBox="0 0 360 300" role="img" aria-label="Колесо баланса: сравнение текущего и предыдущего периода">
    {[2, 4, 6, 8, 10].map(value => <polygon key={value} points={balanceLabels.map((_, index) => point(index, value * 10.5).join(",")).join(" ")} fill="none" stroke="#283550"/>)}
    {balanceLabels.map((label, index) => <g key={label}><line x1="180" y1="150" x2={point(index, 105)[0]} y2={point(index, 105)[1]} stroke="#26334d"/><text x={point(index, 133)[0]} y={point(index, 133)[1]} textAnchor="middle" dominantBaseline="middle">{label}</text></g>)}
    {showPrevious && previous && <polygon points={previous.map((value, index) => point(index, value * 10.5).join(",")).join(" ")} fill="none" stroke="#8292b3" strokeWidth="2" strokeDasharray="5 5"/>}
    {showCurrent && current && <polygon points={current.map((value, index) => point(index, value * 10.5).join(",")).join(" ")} fill="#2ad0ff20" stroke="#3ad5ff" strokeWidth="2"/>}
  </svg></div>;
}

export function ScatterChart({ pairs, xLabel, yLabel }: { pairs: Pair[]; xLabel: string; yLabel: string }) {
  const [active, setActive] = useState<Pair | null>(null);
  if (!pairs.length) return <div className={styles.emptyScatter}>Нет дней с обоими показателями. Выберите другой период или включите демоисторию в настройках.</div>;
  const minX = Math.min(...pairs.map(item => item.x)), maxX = Math.max(...pairs.map(item => item.x));
  const minY = Math.min(...pairs.map(item => item.y)), maxY = Math.max(...pairs.map(item => item.y));
  const dx = Math.max(.1, maxX - minX), dy = Math.max(.1, maxY - minY);
  const x = (value: number) => 72 + (value - minX + dx * .08) / (dx * 1.16) * 790;
  const y = (value: number) => 255 - (value - minY + dy * .1) / (dy * 1.2) * 220;
  const mx = mean(pairs.map(item => item.x)), my = mean(pairs.map(item => item.y));
  const xx = pairs.reduce((sum, item) => sum + (item.x - mx) ** 2, 0);
  const slope = xx ? pairs.reduce((sum, item) => sum + (item.x - mx) * (item.y - my), 0) / xx : null;
  const showTrend = pairs.length >= 5 && slope !== null && (maxY - minY) > 1e-8;
  return <div className={styles.chartScroll}><div className={styles.scatter}><svg viewBox="0 0 930 320" preserveAspectRatio="none" role="img" aria-label={`${xLabel} и ${yLabel}: ${pairs.length} пар значений`}>
    <defs><clipPath id="scatter-clip"><rect x="60" y="20" width="825" height="240"/></clipPath></defs>
    {Array.from({ length: 5 }, (_, index) => { const xv = minX + (maxX - minX) * index / 4, yv = minY + (maxY - minY) * index / 4; return <g key={index}><line x1="60" x2="885" y1={y(yv)} y2={y(yv)} stroke="#27334c"/><text x="48" y={y(yv) + 4} textAnchor="end" className={styles.axisLabel}>{yv.toFixed(2)}</text><text x={x(xv)} y="282" textAnchor="middle" className={styles.axisLabel}>{xv.toFixed(1)}</text></g>; })}
    <g clipPath="url(#scatter-clip)">{showTrend && <line x1={x(minX)} y1={y(my + slope! * (minX - mx))} x2={x(maxX)} y2={y(my + slope! * (maxX - mx))} stroke="#ffb43a" strokeWidth="2" strokeDasharray="6 5"/>}{pairs.map(pair => <circle key={pair.date} cx={x(pair.x)} cy={y(pair.y)} r={active?.date === pair.date ? 7 : 5} fill="#2dcefa" fillOpacity={active?.date === pair.date ? 1 : .65} stroke="#7de4ff" strokeOpacity=".5" tabIndex={0} role="img" aria-label={`${labelDate(pair.date)}: ${xLabel} ${pair.x.toFixed(1)}, ${yLabel} ${pair.y.toFixed(2)}`} onPointerEnter={() => setActive(pair)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(pair)} onBlur={() => setActive(null)}/>)}</g>
    <text x="475" y="312" textAnchor="middle" className={styles.axisLabel}>{xLabel}</text>
  </svg>{active && <div className={styles.chartTooltip} role="status"><strong>{labelDate(active.date)}</strong><span>{xLabel}: {active.x.toFixed(1)} · {yLabel}: {active.y.toFixed(2)}</span></div>}</div></div>;
}
