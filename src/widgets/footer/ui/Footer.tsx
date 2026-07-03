import { useSeason } from '@/entities/league/api/useSeason';
import styles from './Footer.module.css';

export function Footer() {
  const { chain } = useSeason();
  const seasons = (chain ?? []).map((l) => l.season);
  const span = seasons.length ? `${seasons[seasons.length - 1]}–${seasons[0]}` : '…';
  return (
    <footer className={styles.footer}>
      <img src="/logo-circle.png" alt="" className={styles.badge} />
      <span className={styles.line}>
        M$G FANTASY FOOTBALL LEAGUE · EST. 2012 · LIVE DATA VIA SLEEPER · {span}
      </span>
      <span className={styles.quote}>"it's not a gambling problem if you never win."</span>
    </footer>
  );
}
