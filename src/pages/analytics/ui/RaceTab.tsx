import { useMemo } from 'react';
import { fmt, fmt0, ord } from '@/shared/lib/format';
import { closeGames, scheduleStrength, weeklyHeat } from '../model/analytics';
import { byeCount, oddsTimeline } from '../model/odds';
import { BarList, HeatTable, Journey, Sparkline } from './Bars';
import { ChartPanel, Name, Num, oddsPct, signed, type TabProps } from './ChartPanel';
import styles from './AnalyticsPage.module.css';

const CLOSE_MARGIN = 10;

export function RaceTab(p: TabProps) {
  const { league, weeks, games, standings, through, complete, selected, onSelect, nameOf, savage } = p;
  const pws = league.settings?.playoff_week_start ?? 15;
  const playoffTeams = league.settings?.playoff_teams ?? 6;
  const rosterIds = useMemo(() => standings.map((s) => s.rosterId), [standings]);

  const odds = useMemo(
    () => oddsTimeline({ weeks, rosterIds, lastRegular: pws - 1, playoffTeams, through }),
    [weeks, rosterIds, pws, playoffTeams, through],
  );
  const heat = useMemo(() => weeklyHeat(games), [games]);
  const sos = useMemo(() => scheduleStrength(games), [games]);
  const close = useMemo(() => closeGames(games, CLOSE_MARGIN), [games]);

  const byes = byeCount(playoffTeams);
  const weekCols = Array.from({ length: through }, (_, i) => ({ key: String(i + 1), label: `W${i + 1}` }));

  return (
    <div className={styles.stack}>
      <ChartPanel
        label={complete ? (savage ? 'PLAYOFF ODDS · HOW IT ALL WENT DOWN' : 'PLAYOFF ODDS · HOW THE RACE UNFOLDED') : savage ? 'PLAYOFF ODDS · WHO’S SWEATING' : 'PLAYOFF ODDS'}
        headline={oddsHeadline(odds, complete, nameOf, savage)}
        how={
          complete
            ? savage
              ? 'Each line is a team’s playoff odds after every week, from preseason to the end. The middle line is a coin flip. Watch who fell off a cliff.'
              : 'Each line traces a team’s playoff odds after every week of the season; the middle line is 50%.'
            : savage
            ? `Thousands of simulated rest-of-seasons, built on everyone's real scoring. Top ${playoffTeams} get in${byes ? `, top ${byes} skip round one` : ''}, last place gets the Sacko conversation. The squiggle is how the odds moved week by week.`
            : `We simulate the rest of the regular season thousands of times using each team's scoring so far. Top ${playoffTeams} make the playoffs${byes ? ` and the top ${byes} get a bye` : ''}. The line shows each team's odds after every week.`
        }
      >
        <BarList
          mode="meter"
          label="Playoff odds"
          thresholds={{ lo: 0.2, hi: 0.8 }}
          selected={selected}
          onSelect={onSelect}
          rows={odds.map((o) =>
            complete
              ? {
                  // A finished season is all 100s and 0s — the story is the ride.
                  rosterId: o.rosterId,
                  label: nameOf(o.rosterId),
                  value: o.now.playoff,
                  text: o.now.bye ? 'BYE' : o.now.playoff ? 'IN' : o.now.last ? (savage ? 'SACKO' : 'LAST') : 'OUT',
                  sub: `peak ${oddsPct(Math.max(...o.playoff))} · low ${oddsPct(Math.min(...o.playoff))}`,
                  track: <Journey values={o.playoff} on={o.rosterId === selected} made={o.now.playoff === 1} />,
                }
              : {
                  rosterId: o.rosterId,
                  label: nameOf(o.rosterId),
                  value: o.now.playoff,
                  text: oddsPct(o.now.playoff),
                  sub: `${byes ? `BYE ${oddsPct(o.now.bye)} · ` : ''}${savage ? 'SACKO' : 'LAST'} ${oddsPct(o.now.last)}`,
                  extra: <Sparkline values={o.playoff} on={o.rosterId === selected} />,
                },
          )}
        />
      </ChartPanel>

      <ChartPanel
        label={savage ? 'WEEK BY WEEK · WHO SHOWED UP' : 'WEEKLY SCORES · HEATMAP'}
        headline={heatHeadline(heat, rosterIds, nameOf, savage)}
        how={
          savage
            ? "Every team's score every week. The redder the cell, the higher it ranked that week. Pale rows are teams that keep no-showing."
            : 'Each cell is one week’s score; the stronger the red, the better it ranked among all teams that week.'
        }
      >
        <HeatTable
          caption="Weekly scores per team, shaded by that week's rank"
          mode="sequential"
          columns={weekCols}
          tailLabel="AVG"
          selected={selected}
          onSelect={onSelect}
          rows={standings.map((s) => {
            const weeksOf = heat.get(s.rosterId);
            const cells: Record<string, { text: string; heat: number; title: string }> = {};
            let sum = 0;
            let n = 0;
            weeksOf?.forEach((c, w) => {
              cells[String(w)] = {
                text: fmt0(c.pts),
                heat: c.of > 1 ? 1 - (c.rank - 1) / (c.of - 1) : 0.5,
                title: `Week ${w}: ${fmt(c.pts)} — ${ord(c.rank)} of ${c.of}`,
              };
              sum += c.pts;
              n += 1;
            });
            return { rosterId: s.rosterId, label: nameOf(s.rosterId), cells, tail: n ? fmt(sum / n) : '—' };
          })}
        />
      </ChartPanel>

      <div className={styles.pair}>
        <ChartPanel
          label={savage ? 'STRENGTH OF SCHEDULE · RIGGED?' : 'STRENGTH OF SCHEDULE'}
          headline={sosHeadline(sos, nameOf, savage)}
          how={
            savage
              ? 'How good your opponents are on average, against the league. Right = you drew the killers. Left = you got the soft part of the calendar.'
              : 'The average season score of the opponents each team has faced, compared with the league average. Right means a tougher schedule.'
          }
        >
          <BarList
            mode="diverging"
            positiveIsBad
            label="Strength of schedule"
            selected={selected}
            onSelect={onSelect}
            rows={sos.map((r) => ({
              rosterId: r.rosterId,
              label: nameOf(r.rosterId),
              value: r.diff,
              text: signed(r.diff),
              sub: `opp ${r.oppAvg.toFixed(1)} · PA ${r.paPerGame.toFixed(1)}`,
            }))}
          />
        </ChartPanel>

        <ChartPanel
          label={savage ? 'CLOSE GAMES · ICE IN THE VEINS' : `CLOSE GAMES · DECIDED BY < ${CLOSE_MARGIN}`}
          headline={closeHeadline(close, nameOf, savage)}
          how={
            savage
              ? `Record in games decided by fewer than ${CLOSE_MARGIN} points. Clutch, or just lucky? (It's lucky.)`
              : `Each team's record in games decided by fewer than ${CLOSE_MARGIN} points.`
          }
        >
          <BarList
            mode="meter"
            label="Close-game record"
            thresholds={{ lo: 0.34, hi: 0.66 }}
            selected={selected}
            onSelect={onSelect}
            rows={close.map((r) => {
              const n = r.w + r.l + r.t;
              return {
                rosterId: r.rosterId,
                label: nameOf(r.rosterId),
                value: n ? (r.w + r.t / 2) / n : 0,
                text: `${r.w}–${r.l}${r.t ? `–${r.t}` : ''}`,
                sub: n ? `${n} of ${r.games} close` : savage ? 'no drama, ever' : 'no close games',
              };
            })}
          />
        </ChartPanel>
      </div>
    </div>
  );
}

function oddsHeadline(odds: ReturnType<typeof oddsTimeline>, complete: boolean, nameOf: (r: number) => string, savage: boolean) {
  if (!odds.length) return null;
  if (complete) {
    // The story of a finished season: who blew a sure thing, who came from nowhere.
    const collapse = odds
      .filter((o) => o.now.playoff === 0)
      .map((o) => ({ o, peak: Math.max(...o.playoff), at: o.playoff.indexOf(Math.max(...o.playoff)) }))
      .sort((a, b) => b.peak - a.peak)[0];
    const climb = odds
      .filter((o) => o.now.playoff === 1)
      .map((o) => ({ o, low: Math.min(...o.playoff.slice(1)), at: o.playoff.indexOf(Math.min(...o.playoff.slice(1))) }))
      .sort((a, b) => a.low - b.low)[0];
    return (
      <>
        {collapse && collapse.peak >= 0.4 && (
          <>
            <Name>{nameOf(collapse.o.rosterId)}</Name> {savage ? 'was sitting at' : 'peaked at'} <Num>{oddsPct(collapse.peak)}</Num> <When week={collapse.at} />{' '}
            {savage ? 'and still found a way to miss. ' : 'and missed the playoffs. '}
          </>
        )}
        {climb && climb.low <= 0.4 && (
          <>
            <Name>{nameOf(climb.o.rosterId)}</Name> {savage ? 'was left for dead' : 'was down'} at <Num>{oddsPct(climb.low)}</Num> <When week={climb.at} />{' '}
            {savage ? 'and crawled in anyway.' : 'and made it in.'}
          </>
        )}
        {!(collapse && collapse.peak >= 0.4) && !(climb && climb.low <= 0.4) && (savage ? 'Chalk. The good teams got in. Boring.' : 'No major surprises — the playoff field was set early.')}
      </>
    );
  }
  const lock = odds[0]!;
  const bubble = [...odds].sort((a, b) => Math.abs(a.now.playoff - 0.5) - Math.abs(b.now.playoff - 0.5))[0]!;
  const doom = [...odds].sort((a, b) => b.now.last - a.now.last)[0]!;
  return (
    <>
      <Name>{nameOf(lock.rosterId)}</Name> {lock.now.playoff >= 0.95 ? (savage ? 'is basically in' : 'is all but in') : savage ? 'is the safest bet' : 'leads the field'} at{' '}
      <Num>{oddsPct(lock.now.playoff)}</Num>.{' '}
      <Name>{nameOf(bubble.rosterId)}</Name> {savage ? 'is sweating on the bubble' : 'sits on the bubble'} at <Num>{oddsPct(bubble.now.playoff)}</Num>.{' '}
      {doom.now.last > 0.2 && (
        <>
          <Name>{nameOf(doom.rosterId)}</Name> has a <Num>{oddsPct(doom.now.last)}</Num> {savage ? 'shot at the Sacko.' : 'chance of finishing last.'}
        </>
      )}
    </>
  );
}

function heatHeadline(heat: ReturnType<typeof weeklyHeat>, rosterIds: number[], nameOf: (r: number) => string, savage: boolean) {
  const tally = rosterIds.map((r) => {
    const cells = [...(heat.get(r)?.values() ?? [])];
    return { r, tops: cells.filter((c) => c.rank === 1).length, bottoms: cells.filter((c) => c.rank > c.of - 3).length, n: cells.length };
  });
  const hot = [...tally].sort((a, b) => b.tops - a.tops)[0];
  const cold = [...tally].sort((a, b) => b.bottoms - a.bottoms)[0];
  if (!hot || !cold || !hot.n) return null;
  return (
    <>
      <Name>{nameOf(hot.r)}</Name> {savage ? 'has dropped the week’s top score' : 'has posted the week’s top score'} <Num>{hot.tops}</Num>{' '}
      {hot.tops === 1 ? 'time' : 'times'}. <Name>{nameOf(cold.r)}</Name> {savage ? 'has been bottom-three' : 'has finished bottom-three'} in{' '}
      <Num>{cold.bottoms}</Num> of <Num>{cold.n}</Num> weeks{savage ? '. Rough.' : '.'}
    </>
  );
}

function sosHeadline(sos: ReturnType<typeof scheduleStrength>, nameOf: (r: number) => string, savage: boolean) {
  const hard = sos[0];
  const easy = sos.at(-1);
  if (!hard || !easy) return null;
  return (
    <>
      <Name>{nameOf(hard.rosterId)}</Name> {savage ? 'drew the gauntlet' : 'has faced the toughest schedule'}: <Num>{signed(hard.diff)}</Num>{' '}
      {savage ? 'points a week above par.' : 'points per week above average.'} <Name>{nameOf(easy.rosterId)}</Name>{' '}
      {savage ? 'got the cupcakes' : 'has had the easiest'} (<Num>{signed(easy.diff)}</Num>).
    </>
  );
}

function closeHeadline(close: ReturnType<typeof closeGames>, nameOf: (r: number) => string, savage: boolean) {
  const played = close.filter((r) => r.w + r.l + r.t > 0);
  // Clutch = most close wins at the best rate; snakebit = most close losses.
  const best = [...played].sort((a, b) => b.w - a.w || a.l - b.l)[0];
  const worst = [...played].sort((a, b) => b.l - a.l || a.w - b.w)[0];
  if (!best || !worst || best === worst) return null;
  return (
    <>
      <Name>{nameOf(best.rosterId)}</Name> is <Num>{`${best.w}–${best.l}`}</Num> {savage ? 'when it’s tight.' : 'in close games.'}{' '}
      <Name>{nameOf(worst.rosterId)}</Name> is <Num>{`${worst.w}–${worst.l}`}</Num>
      {savage ? (worst.l >= 2 ? ' — keeps losing by a field goal.' : '.') : ' in them.'}
    </>
  );
}

/** "after week 4", or "before kickoff" for the preseason point. */
function When({ week }: { week: number }) {
  return week === 0 ? (
    <>before kickoff</>
  ) : (
    <>
      after week <Num>{week}</Num>
    </>
  );
}
