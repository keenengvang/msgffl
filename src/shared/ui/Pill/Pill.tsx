import type { ReactNode } from 'react';
import styles from './Pill.module.css';

interface PillProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Pill({ active, onClick, children }: PillProps) {
  return (
    <button
      type="button"
      className={active ? `${styles.pill} ${styles.active}` : styles.pill}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
