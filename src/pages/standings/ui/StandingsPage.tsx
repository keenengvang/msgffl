import { Link } from '@tanstack/react-router';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useBrackets } from '@/entities/bracket/api/useBrackets';
import { titleGame } from '@/entities/bracket/lib/titleGame';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { fmt } from '@/shared/lib/format';
import styles from './StandingsPage.module.css';

export function StandingsPage() {
  const { season, league } = useSeason();
  const { standings, isLoading, error } = useStandings(league);
  const brackets = useBrackets(league);

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings) return <LoadingQuip />;

  const complete = league?.status === 'complete';
  const pTeams = league?.settings?.playoff_teams ?? 8;
  const { champRoster } = titleGame(brackets.data?.winners);
  const maxPf = Math.max(1, ...standings.map((r) => r.pf));

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>Standings</PageTitle>
        <span className={styles.note}>
          TOP {pTeams} MAKE THE DANCE · SEEDING BY RECORD, THEN PF
        </span>
      </div>
      <div className={styles.tableWrap}>
        <div className={styles.table}>
          <div className={styles.head}>
            <span style={{ width: 26 }}>RK</span>
            <span style={{ flex: 1.6, minWidth: 220 }}>TEAM</span>
            <span style={{ width: 64 }}>W–L</span>
            <span style={{ width: 150 }}>SEASON</span>
            <span style={{ width: 76, textAlign: 'right' }}>PF</span>
            <span style={{ width: 76, textAlign: 'right' }}>PA</span>
            <span style={{ width: 70, textAlign: 'right' }}>DIFF</span>
            <span style={{ width: 104, textAlign: 'right' }}>STATUS</span>
          </div>
          {standings.map((r, i) => {
            const isChamp = champRoster != null && r.rosterId === champRoster;
            const isLast = i === standings.length - 1 && complete;
            const inPo = i < pTeams;
            const diff = r.pf - r.pa;
            return (
              <Link
                key={r.rosterId}
                to="/teams/$ownerId"
                params={{ ownerId: r.ownerId }}
                className={`${styles.row} ${isChamp ? styles.rowChamp : isLast ? styles.rowSacko : ''}`}
              >
                <span className={`${styles.rk} ${inPo ? styles.rkHot : styles.rkCold}`}>{i + 1}</span>
                <div className={styles.teamCell}>
                  <TeamAvatar src={r.avatar} size={26} />
                  <div className={styles.teamStack}>
                    <span className={styles.teamName}>{r.team}</span>
                    <span className={styles.ownerName}>{r.owner}</span>
                  </div>
                </div>
                <span className={styles.wl}>
                  {r.w}–{r.l}
                  {r.t ? `–${r.t}` : ''}
                </span>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${inPo ? styles.barHot : styles.barCold}`}
                    style={{ width: `${Math.round((r.pf / maxPf) * 100)}%` }}
                  />
                </div>
                <span className={styles.pf}>{fmt(r.pf)}</span>
                <span className={styles.pa}>{fmt(r.pa)}</span>
                <span className={`${styles.diff} ${diff >= 0 ? styles.diffUp : styles.diffDown}`}>
                  {diff >= 0 ? '+' : ''}
                  {fmt(diff)}
                </span>
                <span className={styles.statusCell}>
                  <span
                    className={`${styles.badge} ${
                      isChamp ? styles.badgeChamp : isLast ? styles.badgeSacko : inPo ? styles.badgePlayoffs : styles.badgeNone
                    }`}
                  >
                    {isChamp ? '★ CHAMPION' : isLast ? 'SACKO' : inPo ? 'PLAYOFFS' : '—'}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
