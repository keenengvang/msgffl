import { useMemo } from 'react';
import { fmt, fmt0 } from '@/shared/lib/format';
import { usePlayersDb } from '@/entities/player/api/usePlayersDb';
import { useSeasonLineups } from '@/entities/matchup/api/useSeasonLineups';
import { luckTable, scoreSpread } from '../model/analytics';
import { benchTable, startingSlots } from '../model/lineups';
import { BarList } from './Bars';
import { ChartPanel, Name, Num, PanelStatus, signed, type TabProps } from './ChartPanel';
import styles from './AnalyticsPage.module.css';

export function SkillTab(p: TabProps) {
  const { league, games, selected, onSelect, nameOf, savage } = p;
  const lineups = useSeasonLineups(league);
  const players = usePlayersDb();

  const luck = useMemo(() => luckTable(games), [games]);
  const spread = useMemo(() => scoreSpread(games), [games]);
  const slots = useMemo(() => startingSlots(league.roster_positions), [league.roster_positions]);
  const bench = useMemo(() => {
    if (!lineups.data || !players.data) return null;
    const db = players.data;
    return benchTable(games, lineups.data, slots, (id) => db[id]?.p);
  }, [games, lineups.data, players.data, slots]);

  const lucky = luck[0];
  const robbed = luck.at(-1);
  const steady = [...spread].sort((a, b) => a.sd - b.sd)[0];
  const wild = [...spread].sort((a, b) => b.sd - a.sd)[0];

  return (
    <div className={styles.stack}>
      <ChartPanel
        label={savage ? 'LUCK · WHO THE SCHEDULE IS CARRYING' : 'LUCK · WINS ABOVE EXPECTED'}
        headline={
          lucky && robbed ? (
            <>
              <Name>{nameOf(lucky.rosterId)}</Name> {savage ? 'has stolen' : 'has'} <Num>{Math.abs(lucky.luckWins).toFixed(1)}</Num>{' '}
              {savage ? 'wins their scoring never earned.' : 'more wins than their scoring would predict.'} <Name>{nameOf(robbed.rosterId)}</Name>{' '}
              {savage ? 'has been robbed of' : 'has'} <Num>{Math.abs(robbed.luckWins).toFixed(1)}</Num>
              {savage ? '.' : ' fewer.'}
            </>
          ) : null
        }
        how={
          savage
            ? 'Expected wins = how often your score would beat every other team that week (all-play). Bars right: the schedule keeps handing you wins. Bars left: you keep running into the week’s best team.'
            : 'We count how often each team’s score would have beaten every other team each week. Bars to the right mean more real wins than that predicts; left means fewer.'
        }
      >
        <BarList
          mode="diverging"
          label="Luck in wins"
          selected={selected}
          onSelect={onSelect}
          rows={luck.map((r) => ({
            rosterId: r.rosterId,
            label: nameOf(r.rosterId),
            value: r.luckWins,
            text: `${signed(r.luckWins)} W`,
            sub: `${r.w}–${r.l}${r.t ? `–${r.t}` : ''} actual · scored like ${(r.apPct * r.games).toFixed(1)}–${((1 - r.apPct) * r.games).toFixed(1)}`,
          }))}
        />
      </ChartPanel>

      <ChartPanel
        label={savage ? 'COACH OF THE YEAR · POINTS LEFT ON THE BENCH' : 'LINEUP EFFICIENCY · POINTS LEFT ON THE BENCH'}
        headline={
          bench && bench.length ? (
            <>
              {savage ? 'Coach of the year: ' : 'Best lineup setter: '}
              <Name>{nameOf(bench[0]!.rosterId)}</Name> (<Num>{`${(bench[0]!.efficiency * 100).toFixed(1)}%`}</Num>).{' '}
              {(() => {
                const worst = [...bench].sort((a, b) => b.left - a.left)[0]!;
                return (
                  <>
                    <Name>{nameOf(worst.rosterId)}</Name> {savage ? 'has benched' : 'has left'} <Num>{fmt0(worst.left)}</Num> {savage ? 'points' : 'points on the bench'}
                    {worst.blown ? (
                      <>
                        {' '}
                        — <Num>{worst.blown}</Num> {worst.blown === 1 ? 'loss' : 'losses'} {savage ? 'they’d have won by starting the right guys.' : 'the best lineup would have won.'}
                      </>
                    ) : (
                      '.'
                    )}
                  </>
                );
              })()}
            </>
          ) : null
        }
        how={
          savage
            ? 'Your score vs. the best lineup you could have started from your own roster that week. 100% = perfect. "Blown" = losses the right lineup would have won.'
            : 'Each team’s actual score as a share of the best possible lineup from its own roster each week. "Blown" counts losses the best lineup would have turned into wins.'
        }
      >
        {bench ? (
          <BarList
            mode="meter"
            label="Lineup efficiency"
            thresholds={{ lo: 0.88, hi: 0.94 }}
            selected={selected}
            onSelect={onSelect}
            rows={bench.map((r) => ({
              rosterId: r.rosterId,
              label: nameOf(r.rosterId),
              // Stretch the useful range: nobody is near 0%, so 70% is the floor.
              value: Math.max(0, (r.efficiency - 0.7) / 0.3),
              text: `${(r.efficiency * 100).toFixed(1)}%`,
              sub: `${fmt0(r.left)} benched${r.blown ? ` · ${r.blown} blown` : ''}`,
            }))}
          />
        ) : (
          <PanelStatus error={lineups.error ?? players.error} savage={savage} />
        )}
      </ChartPanel>

      <ChartPanel
        label={savage ? 'CONSISTENCY · METRONOMES VS CHAOS MERCHANTS' : 'CONSISTENCY'}
        headline={
          steady && wild ? (
            <>
              {savage ? 'Most reliable: ' : 'Most consistent: '}
              <Name>{nameOf(steady.rosterId)}</Name> (<Num>±{fmt(steady.sd)}</Num>). {savage ? 'Total coin flip: ' : 'Least consistent: '}
              <Name>{nameOf(wild.rosterId)}</Name> (<Num>±{fmt(wild.sd)}</Num>)
              {savage ? (
                <>
                  {' '}
                  — anywhere from <Num>{fmt0(wild.min)}</Num> to <Num>{fmt0(wild.max)}</Num>, nobody knows which.
                </>
              ) : (
                '.'
              )}
            </>
          ) : null
        }
        how={
          savage
            ? 'SWING is the typical miss from your own average. Small = you know what you’re getting. Big = boom-or-bust.'
            : 'SWING is the standard deviation of weekly scores — how far a typical week lands from the team’s average.'
        }
      >
        <div className={styles.scroll}>
          <table>
            <thead>
              <tr>
                <th className={styles.left}>MANAGER</th>
                <th>AVG</th>
                <th title="Standard deviation — higher means streakier">SWING</th>
                <th>HIGH</th>
                <th>LOW</th>
              </tr>
            </thead>
            <tbody>
              {[...spread]
                .sort((a, b) => a.sd - b.sd)
                .map((r) => (
                  <tr key={r.rosterId} className={r.rosterId === selected ? styles.rowOn : undefined}>
                    <td className={styles.left}>
                      <button type="button" className={styles.rowName} onClick={() => onSelect(r.rosterId)} aria-pressed={r.rosterId === selected}>
                        {nameOf(r.rosterId)}
                      </button>
                    </td>
                    <td className="uMono">{fmt(r.avg)}</td>
                    <td className="uMono">±{fmt(r.sd)}</td>
                    <td className="uMono">{fmt(r.max)}</td>
                    <td className="uMono">{fmt(r.min)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </ChartPanel>
    </div>
  );
}
