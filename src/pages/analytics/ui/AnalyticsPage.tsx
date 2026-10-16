import { useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useNflState } from '@/entities/league/api/useNflState';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { liveWeekFor } from '@/entities/matchup/lib/liveWeek';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { Picker, type PickerOption } from '@/shared/ui/Picker/Picker';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { analyticsThrough, decidedGames, liveWeekFromRecords } from '../model/analytics';
import { ANALYTICS_TABS, type AnalyticsTab } from '../model/tabs';
import type { TabProps } from './ChartPanel';
import { RaceTab } from './RaceTab';
import { SkillTab } from './SkillTab';
import { RosterTab } from './RosterTab';
import styles from './AnalyticsPage.module.css';

const route = getRouteApi('/analytics');
const EVERYONE = '';

const TAB_LABELS: Record<AnalyticsTab, { savage: string; polite: string }> = {
  race: { savage: 'THE RACE', polite: 'THE RACE' },
  skill: { savage: 'LUCK VS SKILL', polite: 'LUCK & SKILL' },
  roster: { savage: 'ROSTER LAB', polite: 'ROSTER BUILDING' },
};

export function AnalyticsPage() {
  const savage = useSavage();
  const { season, league } = useSeason();
  const nflState = useNflState();
  const { standings, isLoading, error } = useStandings(league);
  const weeks = useSeasonWeeks(league);
  const { tab = 'race' } = route.useSearch();
  const navigate = route.useNavigate();
  // The pick is an owner_id, not a roster_id: roster ids are per-season
  // league slots, so switching seasons would silently move the highlight to
  // whoever holds that slot now. Owner ids follow the manager across years.
  const [pick, setPick] = useState<string>(EVERYONE);

  const pws = league?.settings?.playoff_week_start ?? 15;
  const complete = league?.status === 'complete';
  // /state/nfl down mid-season: fall back to the roster records, which Sleeper
  // only bumps once a week is final. The latest week with points can't stand
  // in for the live week — between Tuesday and the next kickoff it's a final
  // week, and treating it as live would drop it from every chart.
  const nflDown = nflState.isSuccess && !nflState.data && league?.status === 'in_season';
  const liveWeek = nflDown
    ? liveWeekFromRecords(standings ?? [])
    : liveWeekFor({ status: league?.status, playoffWeekStart: pws, nflSeason: nflState.data?.season, nflWeek: nflState.data?.week, season });
  const through = analyticsThrough({ complete, playoffWeekStart: pws, liveWeek });

  const games = useMemo(() => (weeks.data ? decidedGames(weeks.data, through) : []), [weeks.data, through]);

  if (error) return <ErrorPanel error={error} />;
  if (weeks.error && !weeks.data) return <ErrorPanel error={weeks.error} />;
  // nfl-state is never persisted, so a returning visitor can have standings
  // and weeks before it: computing the cutoff then would flash "nothing yet".
  const nflPending = nflState.isLoading && !complete;
  if (isLoading || !standings || !league || !weeks.data || nflPending) return <LoadingQuip text="crunching the tape…" />;

  const byRoster = new Map(standings.map((s) => [s.rosterId, s]));
  const nameOf = (id: number) => byRoster.get(id)?.owner ?? `Team ${id}`;
  const selected = standings.find((s) => s.ownerId === pick)?.rosterId ?? null;
  const pickValue = selected === null ? EVERYONE : pick;
  const toggle = (id: number) => {
    const owner = byRoster.get(id)?.ownerId ?? EVERYONE;
    setPick((cur) => (cur === owner ? EVERYONE : owner));
  };
  const teams: PickerOption<string>[] = [
    { value: EVERYONE, label: savage ? 'Nobody — show me everyone' : 'Everyone' },
    ...[...standings]
      .sort((a, b) => a.owner.localeCompare(b.owner))
      .map((s) => ({ value: s.ownerId, label: s.owner, icon: <TeamAvatar src={s.avatar} size={22} /> })),
  ];

  const header = (
    <div className={styles.titleRow}>
      <PageTitle suffix={season}>Analytics</PageTitle>
      <span className={styles.note}>{savage ? 'THE NUMBERS DON’T LIE. YOUR LINEUPS DID.' : 'THE SEASON, BY THE NUMBERS.'}</span>
    </div>
  );

  if (!games.length) {
    return (
      <div className="pageEnter">
        {header}
        <div className={styles.empty}>
          <EmptyState title={savage ? 'No tape to study yet' : 'Nothing to chart yet'}>
            {savage
              ? 'Charts need finished games. Come back after Week 1, when someone has already embarrassed themselves.'
              : 'Charts appear once the first week of games is final.'}
          </EmptyState>
        </div>
      </div>
    );
  }

  const props: TabProps = {
    league,
    weeks: weeks.data,
    games,
    standings,
    through,
    complete,
    selected,
    onSelect: toggle,
    nameOf,
    savage,
  };

  return (
    <div className="pageEnter">
      {header}

      <nav className={styles.tabs} aria-label="Analytics sections">
        {ANALYTICS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={t === tab ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            aria-current={t === tab ? 'page' : undefined}
            onClick={() => navigate({ search: (prev) => ({ ...prev, tab: t === 'race' ? undefined : t }) })}
          >
            {TAB_LABELS[t][savage ? 'savage' : 'polite']}
          </button>
        ))}
      </nav>

      <div className={styles.filters}>
        <span className={styles.filterLabel}>HIGHLIGHT</span>
        <div className={styles.picker}>
          <Picker value={pickValue} options={teams} onChange={setPick} label="Highlight a team" />
        </div>
        <span className={styles.through}>
          THROUGH WEEK <span className="uMono">{through}</span>
          {complete ? '' : ' · LIVE WEEK EXCLUDED'}
        </span>
      </div>

      {tab === 'race' && <RaceTab {...props} />}
      {tab === 'skill' && <SkillTab {...props} />}
      {tab === 'roster' && <RosterTab {...props} />}
    </div>
  );
}
