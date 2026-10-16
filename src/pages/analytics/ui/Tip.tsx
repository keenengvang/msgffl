import type { ReactNode } from 'react';
import styles from './Charts.module.css';

export interface TipState {
  x: number;
  y: number;
  body: ReactNode;
}

/** The hover/focus tooltip, anchored above a point in the chart's own coordinates. */
export function Tip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null;
  // Keep it on-screen near the edges.
  const x = Math.min(Math.max(tip.x, 90), width - 90);
  return (
    <div className={styles.tip} style={{ left: x, top: tip.y }} role="status">
      {tip.body}
    </div>
  );
}
