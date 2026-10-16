import { useState } from 'react';
import { useElementWidth } from '@/shared/lib/useElementWidth';
import type { RaceRow } from '../model/analytics';
import { Tip, type TipState } from './Tip';
import styles from './Charts.module.css';

interface RaceChartProps {
  rows: RaceRow[];
  nameOf: (rosterId: number) => string;
  selected: number | null;
  onSelect: (rosterId: number) => void;
}

const ROW = 24;

/** Rank after every week, one line per team, #1 on top. Every line is neutral
    and the selected one is red; names sit at the right end (one per rank, so
    they never collide), which keeps identity readable without 14 colors. */
export function RaceChart({ rows, nameOf, selected, onSelect }: RaceChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const weeks = rows[0]?.ranks.length ?? 0;
  const teams = rows.length;
  const narrow = width < 520;
  const M = { top: 14, right: narrow ? 92 : 128, bottom: 30, left: 30 };
  const plotW = Math.max(120, width - M.left - M.right);
  const height = M.top + (teams - 1) * ROW + M.bottom;
  const x = (w: number) => M.left + (weeks <= 1 ? plotW / 2 : ((w - 1) / (weeks - 1)) * plotW);
  const y = (rank: number) => M.top + (rank - 1) * ROW;
  const path = (r: RaceRow) => r.ranks.map((rank, i) => `${i ? 'L' : 'M'}${x(i + 1)},${y(rank)}`).join(' ');
  // Selected last so it draws over the others.
  const ordered = [...rows].sort((a, b) => Number(a.rosterId === selected) - Number(b.rosterId === selected));

  const show = (r: RaceRow, clientX: number, box: DOMRect) => {
    const wk = Math.min(weeks, Math.max(1, Math.round(((clientX - box.left - M.left) / plotW) * (weeks - 1)) + 1));
    const rank = r.ranks[wk - 1]!;
    setTip({
      x: x(wk),
      y: y(rank),
      body: (
        <>
          <span className={styles.tipName}>{nameOf(r.rosterId)}</span>
          Week <span className={styles.tipNum}>{wk}</span> · <span className={styles.tipNum}>#{rank}</span>
        </>
      ),
    });
  };

  return (
    <div ref={ref} className={styles.wrap} onPointerLeave={() => setTip(null)}>
      <svg className={styles.svg} width={width} height={height} role="img" aria-label="Standings race: each team's rank after every week">
        {Array.from({ length: teams }, (_, i) => (
          <text key={i} className={styles.tick} x={M.left - 8} y={y(i + 1) + 4} textAnchor="end">
            {i + 1}
          </text>
        ))}
        {Array.from({ length: weeks }, (_, i) => i + 1)
          // Narrow: every other week counted back from the last, so the final
          // week always has a label and its neighbor never crowds it.
          .filter((w) => !narrow || (weeks - w) % 2 === 0)
          .map((w) => (
            <g key={w}>
              <line className={styles.grid} x1={x(w)} x2={x(w)} y1={y(1)} y2={y(teams)} />
              <text className={styles.tick} x={x(w)} y={height - 8} textAnchor="middle">
                W{w}
              </text>
            </g>
          ))}

        {ordered.map((r) => {
          const on = r.rosterId === selected;
          const dim = selected != null && !on;
          const end = r.ranks.at(-1)!;
          const d = path(r);
          return (
            <g key={r.rosterId}>
              <path className={`${styles.line} ${on ? styles.lineOn : ''} ${dim ? styles.lineDim : ''}`} d={d} />
              {on && r.ranks.map((rank, i) => <circle key={i} className={`${styles.dot} ${styles.dotOn}`} cx={x(i + 1)} cy={y(rank)} r={4} />)}
              <path
                className={styles.hit}
                d={d}
                tabIndex={0}
                aria-label={`${nameOf(r.rosterId)}: rank ${r.ranks.join(', ')} by week`}
                onPointerMove={(e) => show(r, e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
                onFocus={() => setTip({ x: x(weeks), y: y(end), body: <span className={styles.tipName}>{nameOf(r.rosterId)} · #{end}</span> })}
                onBlur={() => setTip(null)}
                onClick={() => onSelect(r.rosterId)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(r.rosterId))}
              />
              <text
                className={`${styles.name} ${on ? styles.nameOn : ''}`}
                x={x(weeks) + 10}
                y={y(end) + 4}
                onClick={() => onSelect(r.rosterId)}
                style={{ cursor: 'pointer' }}
              >
                {nameOf(r.rosterId)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} width={width} />
    </div>
  );
}
