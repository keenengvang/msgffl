import { Link } from '@tanstack/react-router';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useBrackets } from '@/entities/bracket/api/useBrackets';
import { titleGame } from '@/entities/bracket/lib/titleGame';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { fmt, ord } from '@/shared/lib/format';
import styles from './TeamsPage.module.css';

export function TeamsPage() {
  const { season, league } = useSeason();
  const { standings, isLoading, error } = useStandings(league);
  const brackets = useBrackets(league);

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings) return <LoadingQuip />;

  const pTeams = league?.settings?.playoff_teams ?? 8;
  const { champRoster } = titleGame(brackets.data?.winners);

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>The Fourteen</PageTitle>
        <span className={styles.note}>CLICK A TEAM. JUDGE THEM.</span>
      </div>
      <div className={styles.grid}>
        {standings.map((r, i) => {
          const isChamp = champRoster != null && r.rosterId === champRoster;
          return (
            <Link key={r.rosterId} to="/teams/$ownerId" params={{ ownerId: r.ownerId }} className={styles.card}>
              <TeamAvatar src={r.avatar} size={46} className={styles.av} />
              <div className={styles.stack}>
                <span className={styles.team}>{r.team}</span>
                <span className={styles.owner}>
                  {r.owner} · PF {fmt(r.pf)}
                </span>
              </div>
              <div className={styles.right}>
                <span className={styles.rec}>
                  {r.w}–{r.l}
                </span>
                <span className={`${styles.rk} ${isChamp ? styles.rkChamp : i < pTeams ? styles.rkPo : styles.rkOut}`}>
                  {isChamp ? '★ CHAMP' : ord(i + 1)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
