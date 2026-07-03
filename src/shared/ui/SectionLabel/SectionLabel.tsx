import type { ReactNode } from 'react';
import styles from './SectionLabel.module.css';

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className={styles.heading}>{children}</h2>;
}
