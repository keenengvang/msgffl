import { useMemo, useState } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useNflState } from '@/entities/league/api/useNflState';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { liveWeekFor } from '@/entities/matchup/lib/liveWeek';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { Panel } from '@/shared/ui/Panel/Panel';
import { Picker, type PickerOption } from '@/shared/ui/Picker/Picker';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { fmt } from '@/shared/lib/format';
import { analyticsThrough, decidedGames, luckTable, scoreSpread, standingsRace } from '../model/analytics';
import { LuckChart, luckLabel } from './LuckChart';
import { RaceChart } from './RaceChart';
import { SpreadChart } from './SpreadChart';
import styles from './AnalyticsPage.module.css';

const EVERYONE = '';
const rec = (w: number, l: number, t: number) => `${w}–${l}${t ? `–${t}` : ''}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function AnalyticsPage() {
  const savage = useSavage();
  const { season, league } = useSeason();
  const nflState = useNflState();
  const { standings, isLoading, error } = useStandings(league);
  const weeks = useSeasonWeeks(league);
  // The pick is an owner_id, not a roster_id: roster ids are per-season
  // league slots, so switching seasons would silently move the highlight to
  // whoever holds that slot now. Owner ids follow the manager across years.
  const [pick, setPick] = useState<string>(EVERYONE);

  const pws = league?.settings?.playoff_week_start ?? 15;
  const complete = league?.status === 'complete';
  // /state/nfl down mid-season: the latest week with points is the live one.
  const nflDown = nflState.isSuccess && !nflState.data && league?.status === 'in_season';
  const scored = Object.entries(weeks.data ?? {}).reduce(
    (last, [w, rows]) => (rows.some((r) => (r.p || 0) !== 0) ? Math.max(last, Number(w)) : last),
    0,
  );
  const liveWeek = nflDown
    ? Math.max(1, scored)
    : liveWeekFor({ status: league?.status, playoffWeekStart: pws, nflSeason: nflState.data?.season, nflWeek: nflState.data?.week, season });
  const through = analyticsThrough({ complete, playoffWeekStart: pws, liveWeek });

  const stats = useMemo(() => {
    if (!weeks.data || !standings) return null;
    const games = decidedGames(weeks.data, through);
    if (!games.length) return null;
    const ids = standings.map((s) => s.rosterId);
    return { luck: luckTable(games), race: standingsRace(games, ids, through), spread: scoreSpread(games) };
  }, [weeks.data, standings, through]);

  if (error) return <ErrorPanel error={error} />;
  if (weeks.error) return <ErrorPanel error={weeks.error} />;
  if (isLoading || !standings || weeks.isLoading) return <LoadingQuip text="crunching the tape…" />;

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

  if (!stats) {
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

  const lucky = stats.luck[0]!;
  const maxLuck = Math.max(0.01, ...stats.luck.map((r) => Math.abs(r.luck)));
  const unlucky = stats.luck.at(-1)!;
  const spreadWeeks = [...new Set(stats.spread.flatMap((r) => r.scores.map((s) => s.week)))].sort((a, b) => a - b);

  return (
    <div className="pageEnter">
      {header}

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

      <div className={styles.stack}>
        <Panel label={savage ? 'LUCK · WHO’S BEING CARRIED BY THE SCHEDULE' : 'LUCK · ACTUAL VS ALL-PLAY'}>
          <p className={styles.blurb}>
            {savage
              ? 'All-play: your score against all 13 other teams, every week. Above the line, the schedule has been carrying you. Below it, you’ve been robbed.'
              : 'All-play is how often each team would win if it played every other team each week. Above the diagonal means more actual wins than the scoring suggests.'}
          </p>
          <div className={styles.callouts}>
            <span>
              {savage ? '🍀 Horseshoe: ' : 'Luckiest: '}
              <b>{nameOf(lucky.rosterId)}</b> <span className="uMono">{luckLabel(lucky.luck)}</span>
            </span>
            <span>
              {savage ? '🪦 Robbed: ' : 'Unluckiest: '}
              <b>{nameOf(unlucky.rosterId)}</b> <span className="uMono">{luckLabel(unlucky.luck)}</span>
            </span>
          </div>
          <div className={styles.luckGrid}>
            <LuckChart rows={stats.luck} nameOf={nameOf} selected={selected} onSelect={toggle} savage={savage} />
            {/* The same numbers as a ranked list: bars run right for lucky, left for robbed. */}
            <ol className={styles.board} aria-label="Luck leaderboard">
              {stats.luck.map((r) => {
                const on = r.rosterId === selected;
                const w = (Math.abs(r.luck) / maxLuck) * 50;
                return (
                  <li key={r.rosterId} className={on ? `${styles.boardRow} ${styles.boardOn}` : styles.boardRow}>
                    <button type="button" className={styles.boardName} onClick={() => toggle(r.rosterId)}>
                      {nameOf(r.rosterId)}
                    </button>
                    <span className={styles.boardTrack} aria-hidden>
                      <span
                        className={styles.boardBar}
                        style={r.luck >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
                      />
                    </span>
                    <span className={`uMono ${styles.boardVal}`}>{luckLabel(r.luck)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <details className={styles.table}>
            <summary>VIEW AS TABLE</summary>
            <div className={styles.scroll}>
              <table>
                <thead>
                  <tr>
                    <th className={styles.left}>MANAGER</th>
                    <th>RECORD</th>
                    <th>WIN %</th>
                    <th>ALL-PLAY</th>
                    <th>ALL-PLAY %</th>
                    <th>LUCK</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.luck.map((r) => (
                    <tr key={r.rosterId} className={r.rosterId === selected ? styles.rowOn : undefined}>
                      <td className={styles.left}>{nameOf(r.rosterId)}</td>
                      <td className="uMono">{rec(r.w, r.l, r.t)}</td>
                      <td className="uMono">{pct(r.winPct)}</td>
                      <td className="uMono">{rec(r.apW, r.apL, r.apT)}</td>
                      <td className="uMono">{pct(r.apPct)}</td>
                      <td className="uMono">{luckLabel(r.luck)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>

        <Panel label={savage ? 'THE RACE · WATCH SEASONS DIE IN REAL TIME' : 'STANDINGS RACE · RANK BY WEEK'}>
          <p className={styles.blurb}>
            {savage
              ? 'Rank after every week. Pick your team up top and find the exact week it all went wrong.'
              : 'Each team’s place in the standings after every week (wins, then points for). Pick a team to follow its line.'}
          </p>
          <RaceChart rows={stats.race} nameOf={nameOf} selected={selected} onSelect={toggle} />
          <details className={styles.table}>
            <summary>VIEW AS TABLE</summary>
            <div className={styles.scroll}>
              <table>
                <thead>
                  <tr>
                    <th className={styles.left}>MANAGER</th>
                    {stats.race[0]!.ranks.map((_, i) => (
                      <th key={i}>W{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...stats.race]
                    .sort((a, b) => a.ranks.at(-1)! - b.ranks.at(-1)!)
                    .map((r) => (
                      <tr key={r.rosterId} className={r.rosterId === selected ? styles.rowOn : undefined}>
                        <td className={styles.left}>{nameOf(r.rosterId)}</td>
                        {r.ranks.map((rank, i) => (
                          <td key={i} className="uMono">
                            {rank}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>

        <Panel label={savage ? 'BOOM OR BUST · METRONOMES VS CHAOS MERCHANTS' : 'WEEKLY SCORES · CONSISTENCY'}>
          <p className={styles.blurb}>
            {savage
              ? 'Every weekly score, one dot each. The bar is the average. Tight cluster: reliable. Wide spread: you never know which team shows up.'
              : 'Each dot is one week’s score; the bar marks the average. A wider spread means less consistent scoring.'}
          </p>
          <SpreadChart rows={stats.spread} nameOf={nameOf} selected={selected} onSelect={toggle} />
          <details className={styles.table}>
            <summary>VIEW AS TABLE</summary>
            <div className={styles.scroll}>
              <table>
                <thead>
                  <tr>
                    <th className={styles.left}>MANAGER</th>
                    <th>AVG</th>
                    <th>HIGH</th>
                    <th>LOW</th>
                    <th title="Standard deviation — higher means streakier">SWING</th>
                    {spreadWeeks.map((w) => (
                      <th key={w}>W{w}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.spread.map((r) => (
                    <tr key={r.rosterId} className={r.rosterId === selected ? styles.rowOn : undefined}>
                      <td className={styles.left}>{nameOf(r.rosterId)}</td>
                      <td className="uMono">{fmt(r.avg)}</td>
                      <td className="uMono">{fmt(r.max)}</td>
                      <td className="uMono">{fmt(r.min)}</td>
                      <td className="uMono">{fmt(r.sd)}</td>
                      {spreadWeeks.map((w) => {
                        const score = r.scores.find((x) => x.week === w);
                        return (
                          <td key={w} className="uMono">
                            {score ? fmt(score.pts) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>
      </div>
    </div>
  );
}
