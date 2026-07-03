import { getRouteApi } from '@tanstack/react-router';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useNflState } from '@/entities/league/api/useNflState';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { pairMatchups } from '@/entities/matchup/lib/pairMatchups';
import { weekTags } from '@/entities/matchup/lib/weekTags';
import { MatchupCard, type MatchupTagVariant } from '@/entities/matchup/ui/MatchupCard';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { fmt } from '@/shared/lib/format';
import { defaultWeek, weekLabel } from '../model/weekLabels';
import styles from './MatchupsPage.module.css';

const route = getRouteApi('/matchups');

export function MatchupsPage() {
  const savage = useSavage();
  const { season, league } = useSeason();
  const nflState = useNflState();
  const { standings, isLoading, error } = useStandings(league);
  const weeks = useSeasonWeeks(league);
  const { week: weekParam } = route.useSearch();
  const navigate = route.useNavigate();

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings) return <LoadingQuip />;

  const pws = league?.settings?.playoff_week_start ?? 15;
  const week =
    weekParam ??
    defaultWeek({
      status: league?.status,
      playoffWeekStart: pws,
      nflSeason: nflState.data?.season,
      nflWeek: nflState.data?.week,
      season,
    });

  const names: Record<number, (typeof standings)[number]> = {};
  standings.forEach((r) => (names[r.rosterId] = r));

  const wkReady = !!weeks.data;
  const pairs = pairMatchups(weeks.data?.[week] ?? []);
  const played = pairs.some(([a, b]) => (a.p || 0) > 0 || (b.p || 0) > 0);
  const tags = weekTags(pairs);

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>Matchups</PageTitle>
        <span className={styles.note}>
          {wkReady
            ? week >= pws
              ? 'PLAYOFF FOOTBALL. NO FRIENDS.'
              : `REGULAR SEASON · WEEK ${week}`
            : 'pulling the tape…'}
        </span>
      </div>

      <div className={styles.pills}>
        {Array.from({ length: 17 }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            type="button"
            className={w === week ? `${styles.pill} ${styles.pillActive}` : styles.pill}
            onClick={() => navigate({ search: (prev) => ({ ...prev, week: w }) })}
          >
            {weekLabel(w, pws)}
          </button>
        ))}
      </div>

      {wkReady && pairs.length === 0 && (
        <div className={styles.empty}>no games this week. even the schedule needed a break.</div>
      )}
      {!wkReady && <LoadingQuip text="pulling the tape…" />}

      <div className={styles.grid}>
        {pairs.map(([a, b]) => {
          const na = names[a.r];
          const nb = names[b.r];
          const done = (a.p || 0) > 0 || (b.p || 0) > 0;
          // Tag precedence mirrors legacy: NUKE > MASSACRE > PHOTO FINISH.
          let tag = week >= pws ? 'PLAYOFFS' : `WEEK ${week}`;
          let variant: MatchupTagVariant = 'neutral';
          if (played && done && a.m === tags.nuke) {
            tag = savage ? "WEEK'S NUKE" : 'TOP SCORE';
            variant = 'nuke';
          } else if (played && done && a.m === tags.blow) {
            tag = savage ? 'MASSACRE' : 'BLOWOUT';
            variant = 'blow';
          } else if (played && done && a.m === tags.close) {
            tag = 'PHOTO FINISH';
            variant = 'close';
          }
          return (
            <MatchupCard
              key={String(a.m)}
              tag={tag}
              tagVariant={variant}
              mid={done ? `FINAL · MARGIN ${fmt(Math.abs(a.p - b.p))}` : 'NOT PLAYED'}
              done={done}
              a={{
                avatar: na?.avatar ?? '',
                name: na?.team ?? `Roster ${a.r}`,
                owner: na?.owner ?? '',
                pts: done ? fmt(a.p) : '—',
                win: a.p > b.p,
              }}
              b={{
                avatar: nb?.avatar ?? '',
                name: nb?.team ?? `Roster ${b.r}`,
                owner: nb?.owner ?? '',
                pts: done ? fmt(b.p) : '—',
                win: b.p > a.p,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
