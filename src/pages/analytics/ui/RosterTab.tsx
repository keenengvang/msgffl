import { useMemo } from 'react';
import { fmt, fmt0 } from '@/shared/lib/format';
import { useDraft } from '@/entities/draft/api/useDraft';
import { usePlayersDb } from '@/entities/player/api/usePlayersDb';
import { useSeasonLineups } from '@/entities/matchup/api/useSeasonLineups';
import { useSeasonMoves } from '@/entities/transaction/api/useSeasonMoves';
import { draftValue, pickupValue, type PickValue } from '../model/acquisitions';
import { positionStrength, STRENGTH_POSITIONS, startingSlots } from '../model/lineups';
import { BarList, HeatTable } from './Bars';
import { ChartPanel, Name, Num, PanelStatus, signed, type TabProps } from './ChartPanel';
import styles from './AnalyticsPage.module.css';

export function RosterTab(p: TabProps) {
  const { league, games, standings, through, selected, onSelect, nameOf, savage } = p;
  const draft = useDraft(league);
  const players = usePlayersDb();
  const lineups = useSeasonLineups(league);
  const moves = useSeasonMoves(league);

  const slots = useMemo(() => startingSlots(league.roster_positions), [league.roster_positions]);
  const rosterIds = useMemo(() => standings.map((s) => s.rosterId), [standings]);

  const drafted = useMemo(
    () => (draft.data?.picks.length && lineups.data ? draftValue(draft.data.picks, lineups.data, through) : null),
    [draft.data, lineups.data, through],
  );
  const wire = useMemo(
    () => (moves.data && lineups.data ? pickupValue(moves.data, lineups.data, through) : null),
    [moves.data, lineups.data, through],
  );
  const strength = useMemo(() => {
    if (!lineups.data || !players.data) return null;
    const db = players.data;
    return positionStrength(games, lineups.data, slots, (id) => db[id]?.p, rosterIds);
  }, [games, lineups.data, players.data, slots, rosterIds]);

  const playerName = (id: string) => players.data?.[id]?.n ?? id;
  const pickLine = (v: PickValue) => `${v.name} (${v.pos || '—'}, #${v.pickNo}) ${signed(v.value, 0)}`;

  const steals = drafted ? [...drafted.picks].sort((a, b) => b.value - a.value).slice(0, 5) : [];
  const busts = drafted ? [...drafted.picks].sort((a, b) => a.value - b.value).slice(0, 5) : [];

  return (
    <div className={styles.stack}>
      <ChartPanel
        label={savage ? 'DRAFT ROI · WHO WON DRAFT NIGHT' : 'DRAFT ROI · VALUE OVER PICK'}
        headline={
          drafted && drafted.classes.length ? (
            <>
              {savage ? 'Best draft: ' : 'Best draft class: '}
              <Name>{nameOf(drafted.classes[0]!.rosterId)}</Name> (<Num>{signed(drafted.classes[0]!.value, 0)}</Num> {savage ? 'over the going rate' : 'points over expectation'}).{' '}
              {savage ? 'Steal of the draft: ' : 'Best pick: '}
              <Name>{steals[0]!.name}</Name> at <Num>#{steals[0]!.pickNo}</Num> to <Name>{nameOf(steals[0]!.rosterId)}</Name>.{' '}
              {savage ? 'Biggest bust: ' : 'Biggest miss: '}
              <Name>{busts[0]!.name}</Name> at <Num>#{busts[0]!.pickNo}</Num>
              {savage ? ` — ${nameOf(busts[0]!.rosterId)} spent a round-${busts[0]!.round} pick on that.` : '.'}
            </>
          ) : null
        }
        how={
          savage
            ? 'Points each pick scored in YOUR starting lineup vs. what picks around that slot usually return. Cut him in week 1 and he’s a bust for you, whatever he did next. Bars right = you drafted better than your slots.'
            : 'Points each pick scored in the drafting team’s starting lineup, compared with what nearby picks returned. The total is each manager’s draft value over expectation.'
        }
      >
        {drafted ? (
          <>
            <BarList
              mode="diverging"
              label="Draft value over expectation"
              selected={selected}
              onSelect={onSelect}
              rows={drafted.classes.map((c) => ({
                rosterId: c.rosterId,
                label: nameOf(c.rosterId),
                value: c.value,
                text: signed(c.value, 0),
                sub: `best: ${c.best.name} ${signed(c.best.value, 0)}`,
              }))}
            />
            <div className={styles.lists}>
              <PickList title={savage ? 'HEISTS' : 'BEST PICKS'} picks={steals} line={pickLine} nameOf={nameOf} />
              <PickList title={savage ? 'MONEY PITS' : 'BIGGEST MISSES'} picks={busts} line={pickLine} nameOf={nameOf} />
            </div>
          </>
        ) : (
          <PanelStatus
            error={draft.error ?? lineups.error}
            savage={savage}
            empty={
              draft.data && !draft.data.picks.length
                ? savage
                  ? 'No draft yet. Nothing to grade but your optimism.'
                  : 'The draft hasn’t happened yet.'
                : undefined
            }
          />
        )}
      </ChartPanel>

      <ChartPanel
        label={savage ? 'WAIVER WIRE ROI · FAAB WELL SPENT?' : 'WAIVER WIRE ROI'}
        headline={
          wire && wire.pickups.length ? (
            <>
              {savage ? 'Best pickup: ' : 'Most valuable pickup: '}
              <Name>{playerName(wire.pickups[0]!.playerId)}</Name> to <Name>{nameOf(wire.pickups[0]!.rosterId)}</Name> in week{' '}
              <Num>{wire.pickups[0]!.week}</Num> — <Num>{fmt0(wire.pickups[0]!.started)}</Num> starting points for{' '}
              <Num>${wire.pickups[0]!.bid}</Num>
              {wire.pickups[0]!.bid === 0 && savage ? '. Free money.' : '.'}
            </>
          ) : null
        }
        how={
          savage
            ? 'Points your pickups scored while in your starting lineup — bench points win nothing. FAAB counts winning bids only.'
            : 'Points scored by players each team added from waivers or free agency, counted only while they were in the starting lineup. FAAB counts winning bids.'
        }
      >
        {wire ? (
          <>
            <BarList
              mode="meter"
              label="Waiver wire return"
              selected={selected}
              onSelect={onSelect}
              rows={wire.rows.map((r) => ({
                rosterId: r.rosterId,
                label: nameOf(r.rosterId),
                value: r.started / Math.max(1, wire.rows[0]!.started),
                text: fmt0(r.started),
                sub: `$${r.faab} FAAB · ${r.adds} adds${r.perDollar !== null ? ` · ${r.perDollar.toFixed(1)} pts/$` : ''}`,
              }))}
            />
            <div className={styles.lists}>
              <div>
                <span className={styles.listTitle}>{savage ? 'WIRE GEMS' : 'TOP PICKUPS'}</span>
                <ol className={styles.miniList}>
                  {wire.pickups.slice(0, 5).map((pu) => (
                    <li key={`${pu.rosterId}|${pu.playerId}`} className={pu.rosterId === selected ? styles.miniOn : undefined}>
                      <span>
                        {playerName(pu.playerId)} → {nameOf(pu.rosterId)}
                      </span>
                      <span className="uMono">
                        wk {pu.week} · ${pu.bid} · {fmt0(pu.started)} pts
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        ) : (
          <PanelStatus error={moves.error ?? lineups.error} savage={savage} />
        )}
      </ChartPanel>

      <ChartPanel
        label={savage ? 'POSITION STRENGTH · WHERE YOUR ROSTER IS SOFT' : 'POSITION STRENGTH'}
        headline={strength ? strengthHeadline(strength, nameOf, savage) : null}
        how={
          savage
            ? 'Starting points per week from each position vs. the league average. Green = an edge. Pink = the hole your trade partner will exploit.'
            : 'Points per week each team’s starters scored at each position (flex players count at their real position). Green is above the league average, pink below.'
        }
      >
        {strength ? (
          <HeatTable
            caption="Starting points per week by position, compared with the league average"
            mode="diverging"
            columns={STRENGTH_POSITIONS.map((pos) => ({ key: pos, label: pos }))}
            tailLabel="TOTAL"
            selected={selected}
            onSelect={onSelect}
            rows={strength.rows.map((r) => {
              const cells: Record<string, { text: string; heat: number; title: string }> = {};
              for (const pos of STRENGTH_POSITIONS) {
                const spreadOf = Math.max(1, ...strength.rows.map((x) => Math.abs(x.diff[pos])));
                cells[pos] = {
                  text: r.perGame[pos].toFixed(1),
                  heat: r.diff[pos] / spreadOf,
                  title: `${pos}: ${fmt(r.perGame[pos])}/wk (${signed(r.diff[pos])} vs league)`,
                };
              }
              const total = STRENGTH_POSITIONS.reduce((a, pos) => a + r.perGame[pos], 0);
              return { rosterId: r.rosterId, label: nameOf(r.rosterId), cells, tail: fmt(total) };
            })}
          />
        ) : (
          <PanelStatus error={lineups.error ?? players.error} savage={savage} />
        )}
      </ChartPanel>
    </div>
  );
}

function PickList({
  title,
  picks,
  line,
  nameOf,
}: {
  title: string;
  picks: PickValue[];
  line: (v: PickValue) => string;
  nameOf: (r: number) => string;
}) {
  return (
    <div>
      <span className={styles.listTitle}>{title}</span>
      <ol className={styles.miniList}>
        {picks.map((v) => (
          <li key={v.pickNo}>
            <span>{line(v)}</span>
            <span className="uMono">{nameOf(v.rosterId)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function strengthHeadline(s: ReturnType<typeof positionStrength>, nameOf: (r: number) => string, savage: boolean) {
  let best = { r: 0, pos: '', d: -Infinity };
  let worst = { r: 0, pos: '', d: Infinity };
  for (const row of s.rows) {
    for (const pos of ['QB', 'RB', 'WR', 'TE'] as const) {
      if (row.diff[pos] > best.d) best = { r: row.rosterId, pos, d: row.diff[pos] };
      if (row.diff[pos] < worst.d) worst = { r: row.rosterId, pos, d: row.diff[pos] };
    }
  }
  if (!best.pos || !worst.pos) return null;
  return (
    <>
      <Name>{nameOf(best.r)}</Name>
      {'’s '}
      {best.pos} {savage ? 'room is the league’s cheat code' : 'group leads the league'} (<Num>{signed(best.d)}</Num>/wk).{' '}
      <Name>{nameOf(worst.r)}</Name>
      {'’s '}
      {worst.pos}s {savage ? 'are a crime scene' : 'trail the league the most'} (<Num>{signed(worst.d)}</Num>/wk).
    </>
  );
}
