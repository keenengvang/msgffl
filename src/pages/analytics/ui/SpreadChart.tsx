import { useState } from 'react';
import { useElementWidth } from '@/shared/lib/useElementWidth';
import { fmt } from '@/shared/lib/format';
import type { SpreadRow } from '../model/analytics';
import { Tip, type TipState } from './Tip';
import styles from './Charts.module.css';

interface SpreadChartProps {
  rows: SpreadRow[];
  nameOf: (rosterId: number) => string;
  selected: number | null;
  onSelect: (rosterId: number) => void;
}

const ROW = 28;

/** Every weekly score per team as a dot on one row, with a tick at the
    average. A tight cluster is a metronome; a wide one is chaos. */
export function SpreadChart({ rows, nameOf, selected, onSelect }: SpreadChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const narrow = width < 520;
  const M = { top: 8, right: 16, bottom: 30, left: narrow ? 92 : 130 };
  const plotW = Math.max(120, width - M.left - M.right);
  const height = M.top + rows.length * ROW + M.bottom;
  const all = rows.flatMap((r) => r.scores.map((s) => s.pts));
  const lo = Math.floor(Math.min(...all, 60) / 20) * 20;
  const hi = Math.ceil(Math.max(...all, 120) / 20) * 20;
  const x = (v: number) => M.left + ((v - lo) / (hi - lo)) * plotW;
  const yMid = (i: number) => M.top + i * ROW + ROW / 2;
  const step = narrow ? 40 : 20;
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

  return (
    <div ref={ref} className={styles.wrap} onPointerLeave={() => setTip(null)}>
      <svg className={styles.svg} width={width} height={height} role="img" aria-label="Weekly scores per team">
        {ticks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={x(t)} x2={x(t)} y1={M.top} y2={height - M.bottom} />
            <text className={styles.tick} x={x(t)} y={height - 10} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const on = r.rosterId === selected;
          const cy = yMid(i);
          return (
            <g key={r.rosterId}>
              <text
                className={`${styles.name} ${on ? styles.nameOn : ''}`}
                x={M.left - 12}
                y={cy + 4}
                textAnchor="end"
                onClick={() => onSelect(r.rosterId)}
                style={{ cursor: 'pointer' }}
              >
                {nameOf(r.rosterId)}
              </text>
              <line className={styles.grid} x1={x(r.min)} x2={x(r.max)} y1={cy} y2={cy} />
              {r.scores.map((s) => (
                <circle
                  key={s.week}
                  className={`${styles.dot} ${on ? styles.dotOn : styles.dotFaint}`}
                  cx={x(s.pts)}
                  cy={cy}
                  r={4.5}
                  tabIndex={on ? 0 : -1}
                  aria-label={`${nameOf(r.rosterId)}, week ${s.week}: ${fmt(s.pts)}`}
                  onPointerEnter={() =>
                    setTip({
                      x: x(s.pts),
                      y: cy - 4,
                      body: (
                        <>
                          <span className={styles.tipName}>{nameOf(r.rosterId)}</span>
                          Week <span className={styles.tipNum}>{s.week}</span> · <span className={styles.tipNum}>{fmt(s.pts)}</span>
                        </>
                      ),
                    })
                  }
                  onClick={() => onSelect(r.rosterId)}
                />
              ))}
              <line className={`${styles.avg} ${on ? styles.avgOn : ''}`} x1={x(r.avg)} x2={x(r.avg)} y1={cy - 9} y2={cy + 9} />
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} width={width} />
    </div>
  );
}
