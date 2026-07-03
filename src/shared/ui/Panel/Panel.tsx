import type { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  label?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ label, action, children, className }: PanelProps) {
  return (
    <section className={`${styles.panel} ${className ?? ''}`}>
      {(label || action) && (
        <div className={styles.labelRow}>
          {label && <span className="uLabel">{label}</span>}
          {action && <span className={styles.action}>{action}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
