import { useState } from 'react';
import { QUIPS } from '@/shared/config/constants';
import styles from './LoadingQuip.module.css';

interface LoadingQuipProps {
  /** Override the random quip, e.g. "pulling the tape…". */
  text?: string;
}

export function LoadingQuip({ text }: LoadingQuipProps) {
  const [quip] = useState(() => text ?? QUIPS[Math.floor(Math.random() * QUIPS.length)]);
  return (
    <div className={styles.wrap} role="status">
      <span className={`${styles.dot} ${styles.pulsing}`} />
      <span className={styles.quip}>{quip}</span>
    </div>
  );
}
