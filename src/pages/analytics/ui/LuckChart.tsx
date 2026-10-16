import { useState } from 'react';
import { useElementWidth } from '@/shared/lib/useElementWidth';
import type { LuckRow } from '../model/analytics';
import { Tip, type TipState } from './Tip';
import styles from './Charts.module.css';

interface LuckChartProps {
  rows: LuckRow[];
  nameOf: (rosterId: number) => string;
  selected: number | null;
  onSelect: (rosterId: number) => void;
  savage: boolean;
}

const M = { top: 16, right: 18, bottom: 40, left: 46 };
const TICKS = [0, 0.25, 0.5, 0.75, 1];
const pctLabel = (v: number) => `${Math.round(v * 100)}%`;
const rec = (w: number, l: number, t: number) => `${w}–${l}${t ? `–${t}` : ''}`;
export const luckLabel = (luck: number) => `${luck >= 0 ? '+' : '−'}${Math.round(Math.abs(luck) * 100)}`;

/** Actual win% (y) against all-play win% (x). The diagonal is "fair": above
    it you're winning more than your scoring deserves. Position carries the
    meaning; color only marks the selected team. */
export function LuckChart({ rows, nameOf, selected, onSelect, savage }: LuckChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const size = Math.min(width, 520);
  const plot = size - M.left - M.right;
  const height = plot + M.top + M.bottom;
  const x = (v: number) => M.left + v * plot;
  const y = (v: number) => M.top + (1 - v) * plot;

  // Direct-label only the story: the luckiest, the unluckiest, and the pick.
  const labeled = new Set([rows[0]?.rosterId, rows.at(-1)?.rosterId, selected ?? undefined]);
  // Draw the selected team last so it sits on top of any overlap.
  const ordered = [...rows].sort((a, b) => Number(a.rosterId === selected) - Number(b.rosterId === selected));

  const show = (r: LuckRow) =>
    setTip({
      x: x(r.apPct),
      y: y(r.winPct),
      body: (
        <>
          <span className={styles.tipName}>{nameOf(r.rosterId)}</span>
          Record <span className={styles.tipNum}>{rec(r.w, r.l, r.t)}</span> · all-play{' '}
          <span className={styles.tipNum}>{rec(r.apW, r.apL, r.apT)}</span>
          <br />
          Luck <span className={styles.tipNum}>{luckLabel(r.luck)}</span>
        </>
      ),
    });

  return (
    <div ref={ref} className={styles.wrap} onPointerLeave={() => setTip(null)}>
      <svg className={styles.svg} width={size} height={height} role="img" aria-label="Luck chart: actual win percentage against all-play win percentage">
        {TICKS.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} />
            <line className={styles.grid} x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} />
            <text className={styles.tick} x={M.left - 8} y={y(t) + 4} textAnchor="end">
              {pctLabel(t)}
            </text>
            <text className={styles.tick} x={x(t)} y={y(0) + 18} textAnchor="middle">
              {pctLabel(t)}
            </text>
          </g>
        ))}
        <line className={styles.diag} x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} />
        <text className={styles.region} x={x(0.03)} y={y(0.94)}>
          {savage ? 'HORSESHOE ZONE ↑' : 'LUCKY ↑'}
        </text>
        <text className={styles.region} x={x(0.97)} y={y(0.06)} textAnchor="end">
          {savage ? '↓ ROBBED' : '↓ UNLUCKY'}
        </text>
        <text className={styles.axisLabel} x={x(0.5)} y={height - 4} textAnchor="middle">
          ALL-PLAY WIN %
        </text>
        <text className={styles.axisLabel} transform={`translate(12 ${y(0.5)}) rotate(-90)`} textAnchor="middle">
          ACTUAL WIN %
        </text>

        {ordered.map((r) => {
          const on = r.rosterId === selected;
          const cx = x(r.apPct);
          const cy = y(r.winPct);
          return (
            <g key={r.rosterId}>
              {/* 24px hit area around an 11px dot. */}
              <circle
                cx={cx}
                cy={cy}
                r={12}
                fill="transparent"
                onPointerEnter={() => show(r)}
                onClick={() => onSelect(r.rosterId)}
              />
              <circle
                className={`${styles.dot} ${on ? styles.dotOn : ''}`}
                cx={cx}
                cy={cy}
                r={on ? 7 : 5.5}
                tabIndex={0}
                aria-label={`${nameOf(r.rosterId)}: record ${rec(r.w, r.l, r.t)}, all-play ${rec(r.apW, r.apL, r.apT)}, luck ${luckLabel(r.luck)}`}
                onFocus={() => show(r)}
                onBlur={() => setTip(null)}
                onPointerEnter={() => show(r)}
                onClick={() => onSelect(r.rosterId)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(r.rosterId))}
              />
              {labeled.has(r.rosterId) && (
                <text
                  className={`${styles.name} ${on ? styles.nameOn : ''}`}
                  x={cx + (r.apPct > 0.7 ? -10 : 10)}
                  y={cy - 9}
                  textAnchor={r.apPct > 0.7 ? 'end' : 'start'}
                  pointerEvents="none"
                >
                  {nameOf(r.rosterId)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} width={size} />
    </div>
  );
}
