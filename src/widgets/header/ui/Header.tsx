import { Link, useNavigate } from '@tanstack/react-router';
import { useVibes } from '@/shared/lib/vibes';
import { useNflState } from '@/entities/league/api/useNflState';
import { useSeason } from '@/entities/league/api/useSeason';
import type { NflState } from '@/shared/api/types';
import styles from './Header.module.css';

const NAV: Array<[to: string, label: string]> = [
  ['/', 'HOME'],
  ['/standings', 'STANDINGS'],
  ['/matchups', 'MATCHUPS'],
  ['/teams', 'TEAMS'],
  ['/draft', 'DRAFT'],
  ['/players', 'PLAYERS'],
  ['/power', 'POWER'],
  ['/bracket', 'BRACKET'],
  ['/history', 'HISTORY'],
  ['/rules', 'RULE BOOK'],
  ['/suggest', 'SUGGEST'],
];

function countdown(ns: NflState | null | undefined): string {
  if (!ns) return 'SYNCING WITH THE MOTHERSHIP…';
  if (ns.season_type === 'regular') return `WEEK ${ns.week} — LIVE`;
  if (ns.season_start_date) {
    const days = Math.ceil((new Date(ns.season_start_date).getTime() - Date.now()) / 864e5);
    return days > 0
      ? `OFFSEASON · T-MINUS ${days} DAYS TO KICKOFF`
      : `FOOTBALL SEASON · ${(ns.season_type || '').toUpperCase()}`;
  }
  return 'OFFSEASON · THE WAITING ROOM';
}

export function Header() {
  const { motion } = useVibes();
  const nflState = useNflState();
  const { season, chain } = useSeason();
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <img src="/logo-circle.png" alt="MSG badge" className={styles.badge} />
        <div className={styles.wordmark}>
          <span className={styles.title}>M$G FANTASY FOOTBALL</span>
          <span className={styles.tagline}>EST. 2012 · 14 TEAMS · ZERO MERCY</span>
        </div>
        <div className={styles.liveChip}>
          <span className={motion ? `${styles.liveDot} ${styles.pulsing}` : styles.liveDot} />
          {countdown(nflState.data)}
        </div>
        <div className={styles.pills}>
          {(chain ?? []).map((l) => (
            <button
              key={l.league_id}
              type="button"
              className={l.season === season ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              onClick={() => navigate({ to: '.', search: (prev) => ({ ...prev, season: l.season }) })}
            >
              {l.season}
            </button>
          ))}
        </div>
      </div>
      {/* season is carried across pages by the root retainSearchParams middleware */}
      <nav className={styles.navRow}>
        {NAV.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className={styles.navLink}
            activeProps={{ className: `${styles.navLink} ${styles.navActive}` }}
            activeOptions={{ exact: to === '/' }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
