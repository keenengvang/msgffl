import type { CSSProperties, ReactNode } from 'react';
import styles from './Bars.module.css';

export interface BarRow {
  rosterId: number;
  label: string;
  /** Diverging: signed, scaled against `max`. Meter: 0–1. */
  value: number;
  /** The number as people should read it: "+2.6 W", "87%". */
  text: string;
  /** A muted second line of detail under the name. */
  sub?: ReactNode;
  /** An optional trailing column (a sparkline). */
  extra?: ReactNode;
  /** Replaces the bar entirely (a finished season's odds journey). */
  track?: ReactNode;
}

interface BarListProps {
  rows: BarRow[];
  /** diverging: bars grow left/right from a center line (good right).
      meter: a 0–100% fill. */
  mode: 'diverging' | 'meter';
  /** Diverging only: the magnitude a full half-track represents. */
  max?: number;
  /** Meter only: color the fill by value (win ≥ hi, loss ≤ lo). */
  thresholds?: { lo: number; hi: number };
  /** Flip diverging colors when a positive number is bad news (a hard schedule). */
  positiveIsBad?: boolean;
  selected: number | null;
  onSelect: (rosterId: number) => void;
  label: string;
}

/** A ranked list of managers with one bar each — the workhorse of the page.
    Plain HTML so every value is real text: no tooltip needed to read it, and
    screen readers get the list in order. Click a name to highlight it. */
export function BarList({ rows, mode, max, thresholds, positiveIsBad, selected, onSelect, label }: BarListProps) {
  const scale = max ?? Math.max(0.0001, ...rows.map((r) => Math.abs(r.value)));
  const withExtra = rows.some((r) => r.extra);
  return (
    <ol className={withExtra ? `${styles.list} ${styles.withExtra}` : styles.list} aria-label={label}>
      {rows.map((r, i) => {
        const on = r.rosterId === selected;
        let tone: 'good' | 'bad' | 'flat';
        let style: CSSProperties;
        if (mode === 'diverging') {
          const w = Math.min(1, Math.abs(r.value) / scale) * 50;
          const up = r.value >= 0;
          tone = Math.abs(r.value) < scale * 0.02 ? 'flat' : up !== !!positiveIsBad ? 'good' : 'bad';
          style = up ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` };
        } else {
          const v = Math.max(0, Math.min(1, r.value));
          tone = thresholds ? (v >= thresholds.hi ? 'good' : v <= thresholds.lo ? 'bad' : 'flat') : 'flat';
          style = { left: 0, width: `${v * 100}%` };
        }
        return (
          <li key={r.rosterId} className={on ? `${styles.row} ${styles.on}` : styles.row}>
            <span className={`uMono ${styles.rank}`}>{i + 1}</span>
            <span className={styles.who}>
              <button type="button" className={styles.name} onClick={() => onSelect(r.rosterId)} aria-pressed={on}>
                {r.label}
              </button>
              {r.sub && <span className={styles.sub}>{r.sub}</span>}
            </span>
            {r.track ? (
              <span className={styles.trackFree} aria-hidden>
                {r.track}
              </span>
            ) : (
              <span className={mode === 'diverging' ? `${styles.track} ${styles.center}` : styles.track} aria-hidden>
                <span className={`${styles.bar} ${styles[tone]}`} style={style} />
              </span>
            )}
            <span className={`uMono ${styles.val} ${styles[`${tone}Text`]}`}>{r.text}</span>
            {withExtra && <span className={styles.extra}>{r.extra}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** A 0–1 series stretched to fill its cell — a finished season's playoff
    odds from preseason to the final week. The 50% line is the coin flip. */
export function Journey({ values, on, made }: { values: number[]; on: boolean; made: boolean }) {
  if (values.length < 2) return null;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 100).toFixed(2)},${(2 + (1 - v) * 32).toFixed(2)}`).join(' ');
  return (
    <svg className={styles.journey} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden>
      <line className={styles.sparkMid} x1={0} x2={100} y1={18} y2={18} vectorEffect="non-scaling-stroke" />
      <path className={`${styles.sparkLine} ${on ? styles.sparkOn : made ? styles.lineGood : styles.lineBad}`} d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A tiny line of a 0–1 series (playoff odds week by week). Decorative —
    the row it sits in carries the number — so it's hidden from readers. */
export function Sparkline({ values, on }: { values: number[]; on: boolean }) {
  const W = 84;
  const H = 22;
  if (values.length < 2) return <svg width={W} height={H} aria-hidden />;
  const x = (i: number) => 2 + (i / (values.length - 1)) * (W - 4);
  const y = (v: number) => 2 + (1 - v) * (H - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.at(-1)!;
  return (
    <svg width={W} height={H} className={styles.spark} aria-hidden>
      <line className={styles.sparkMid} x1={2} x2={W - 2} y1={y(0.5)} y2={y(0.5)} />
      <path className={on ? `${styles.sparkLine} ${styles.sparkOn}` : styles.sparkLine} d={d} />
      <circle className={on ? `${styles.sparkDot} ${styles.sparkOn}` : styles.sparkDot} cx={x(values.length - 1)} cy={y(last)} r={2.5} />
    </svg>
  );
}

export interface HeatColumn {
  key: string;
  label: string;
}

export interface HeatValue {
  text: string;
  /** Sequential: 0–1 (hot = 1). Diverging: −1…1. */
  heat: number;
  title: string;
}

interface HeatTableProps {
  rows: Array<{ rosterId: number; label: string; cells: Record<string, HeatValue | undefined>; tail?: string }>;
  columns: HeatColumn[];
  mode: 'sequential' | 'diverging';
  tailLabel?: string;
  selected: number | null;
  onSelect: (rosterId: number) => void;
  caption: string;
}

/** A team × column grid with each cell tinted by how good it was. It's a real
    table — the numbers are in the cells — so the color is a bonus, not the data. */
export function HeatTable({ rows, columns, mode, tailLabel, selected, onSelect, caption }: HeatTableProps) {
  return (
    <div className={styles.heatScroll}>
      <table className={styles.heat}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th className={styles.heatName} scope="col">
              MANAGER
            </th>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
            {tailLabel && <th scope="col">{tailLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const on = r.rosterId === selected;
            return (
              <tr key={r.rosterId} className={on ? styles.heatOn : undefined}>
                <th scope="row" className={styles.heatName}>
                  <button type="button" className={styles.name} onClick={() => onSelect(r.rosterId)} aria-pressed={on}>
                    {r.label}
                  </button>
                </th>
                {columns.map((c) => {
                  const v = r.cells[c.key];
                  if (!v) return <td key={c.key} className={styles.heatEmpty} />;
                  const h = Math.max(-1, Math.min(1, v.heat));
                  const cls = mode === 'sequential' ? styles.hot : h >= 0 ? styles.up : styles.down;
                  return (
                    <td key={c.key} className={`uMono ${cls}`} style={{ '--h': Math.abs(h) } as CSSProperties} title={v.title}>
                      {v.text}
                    </td>
                  );
                })}
                {tailLabel && <td className={`uMono ${styles.heatTail}`}>{r.tail}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
