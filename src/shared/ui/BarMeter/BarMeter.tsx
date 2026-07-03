import styles from './BarMeter.module.css';

interface BarMeterProps {
  /** 0–1 fraction of the bar to fill. */
  ratio: number;
}

export function BarMeter({ ratio }: BarMeterProps) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={styles.track}>
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}
