import type { ReactNode } from 'react';
import styles from './PageTitle.module.css';

interface PageTitleProps {
  children: ReactNode;
  /** Red-highlighted trailing text, typically the season year. */
  suffix?: ReactNode;
  kicker?: ReactNode;
}

export function PageTitle({ children, suffix, kicker }: PageTitleProps) {
  return (
    <div>
      <h1 className={styles.title}>
        {children}
        {suffix && <span className={styles.suffix}> {suffix}</span>}
      </h1>
      {kicker && <div className={styles.kicker}>{kicker}</div>}
    </div>
  );
}
