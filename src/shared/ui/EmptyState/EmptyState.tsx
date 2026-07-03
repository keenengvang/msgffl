import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.title}>{title}</div>
      {children && <div className={styles.copy}>{children}</div>}
    </div>
  );
}
