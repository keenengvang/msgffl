import { useMemo, useState } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useNflState } from '@/entities/league/api/useNflState';
import { useStandings } from '@/entities/team/api/useStandings';
import { useLiveWeek, useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { liveWeekFor } from '@/entities/matchup/lib/liveWeek';
import { useBets, useCreateBet, useUpdateBet, BetApiError } from '@/entities/bet/api/useBets';
import { weekIsFinal } from '@/entities/bet/lib/resolveBet';
import type { BetDraft, BetPatch, BetRecord } from '@/entities/bet/model/types';
import { BetCard, type BetSideView } from '@/entities/bet/ui/BetCard';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { Panel } from '@/shared/ui/Panel/Panel';
import { Modal } from '@/shared/ui/Modal/Modal';
import { SectionLabel } from '@/shared/ui/SectionLabel/SectionLabel';
import { fmt0 } from '@/shared/lib/format';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import {
  buildBoard,
  filterBoard,
  lastScoredWeek,
  sortRecord,
  winPct,
  type BoardEntry,
  type BoardFilter,
  type RecordSort,
  type RecordSortKey,
} from '../model/board';
import { BetForm } from './BetForm';
import styles from './BetsPage.module.css';

type Status = { tone: 'ok' | 'err'; text: string } | null;

const errText = (e: unknown, savage: boolean) => {
  if (e instanceof BetApiError) {
    if (e.status === 409) return savage ? 'Someone edited this first. Reloaded — try again.' : 'Someone else changed this bet — reloaded, please retry.';
    return e.message;
  }
  return savage ? "The bookie's phone is off. Try again." : 'Could not reach the server. Try again.';
};

export function BetsPage() {
  const savage = useSavage();
  const { season, league } = useSeason();
  const nflState = useNflState();
  const { standings, isLoading, error } = useStandings(league);
  const pws = league?.settings?.playoff_week_start ?? 15;
  const weeks = useSeasonWeeks(league);
  const scoredThrough = lastScoredWeek(weeks.data);
  // useNflState resolves null when /state/nfl fails, and liveWeekFor would then
  // fall back to week 1 — polling a finished week while this one freezes. Mid-
  // season, the latest week with points on the board is the best stand-in.
  const nflDown = nflState.isSuccess && !nflState.data && league?.status === 'in_season';
  const liveWeek = nflDown
    ? Math.max(1, scoredThrough)
    : liveWeekFor({
        status: league?.status,
        playoffWeekStart: pws,
        nflSeason: nflState.data?.season,
        nflWeek: nflState.data?.week,
        season,
      });
  const live = useLiveWeek(league, liveWeek);
  const bets = useBets(season);
  const create = useCreateBet();
  // Two mutation instances, never more than one write in flight on each.
  // TanStack only runs per-mutate() callbacks for an instance's latest call, so
  // a card action sharing the form's instance would swallow the form's
  // success/conflict handling. The form is frozen while pending; card actions
  // are all disabled while any one is.
  const update = useUpdateBet();
  const cardUpdate = useUpdateBet();

  const [editing, setEditing] = useState<BetRecord | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [status, setStatus] = useState<Status>(null);
  const [editStatus, setEditStatus] = useState<Status>(null);
  const [cardError, setCardError] = useState<{ id: string; text: string } | null>(null);
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [who, setWho] = useState<string | null>(null);
  const [sort, setSort] = useState<RecordSort>({ key: 'won', dir: 'desc' });
  // The route stays mounted when the header switches seasons; an editor opened
  // on another season's bet must not follow along and PATCH a bet that's no
  // longer on the board. Close it (state adjusted during render, not in an effect).
  const [editSeason, setEditSeason] = useState(season);
  if (editSeason !== season) {
    setEditSeason(season);
    setEditing(null);
    setWho(null); // last season's manager filter could empty this board
  }

  const board = useMemo(() => {
    if (!bets.data || !standings || !season) return null;
    const rosterOf: Record<string, number> = {};
    standings.forEach((r) => (rosterOf[r.ownerId] = r.rosterId));
    return buildBoard(bets.data, {
      rosterOf,
      // The live week polls on its own; the 17-week bundle covers the rest.
      rowsFor: (w) => (w === liveWeek && live.data?.length ? live.data : weeks.data?.[w]),
      // Or a later week has started: covers a failed /state/nfl (useNflState
      // resolves null), which would otherwise leave every past week "live".
      isFinal: (w) =>
        weekIsFinal({ status: league?.status, season, nflSeason: nflState.data?.season, nflWeek: nflState.data?.week }, w) ||
        w < scoredThrough,
    });
  }, [bets.data, standings, season, liveWeek, live.data, weeks.data, league?.status, nflState.data, scoredThrough]);

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings || !season || nflState.isLoading) return <LoadingQuip />;

  const managers = [...standings].sort((a, b) => a.owner.localeCompare(b.owner));
  const view = (ownerId: string): BetSideView => {
    const r = standings.find((s) => s.ownerId === ownerId);
    if (r) return { name: r.owner, avatar: r.avatar };
    // Left the league mid-season: a short id tag keeps two departed managers apart.
    return { name: `${savage ? 'Deserter' : 'Ex-member'} #${ownerId.slice(-4)}`, avatar: '' };
  };

  const onCreate = (draft: BetDraft) => {
    setStatus(null);
    create.mutate(
      { draft },
      {
        onSuccess: () => {
          setFormKey((k) => k + 1); // fresh, empty form
          setStatus({ tone: 'ok', text: savage ? 'Booked. No backing out now.' : 'Bet added.' });
        },
        onError: (e) => setStatus({ tone: 'err', text: errText(e, savage) }),
      },
    );
  };

  const onEdit = (bet: BetRecord, patch: BetPatch) => {
    setEditStatus(null);
    if (Object.keys(patch).length === 0) {
      setEditing(null);
      return;
    }
    update.mutate(
      { bet, patch },
      {
        // Functional updates: by the time this lands the user may have opened
        // a different bet — only touch the editor if it's still this one.
        // The modal closes and the card updates in place — that's the confirmation.
        onSuccess: () => setEditing((cur) => (cur?.id === bet.id ? null : cur)),
        onError: (e) => {
          // Lost a race: point the open editor at the winner's copy so the
          // retry carries the fresh version (the typed fields are kept).
          if (e instanceof BetApiError && e.fresh) {
            const fresh = e.fresh;
            // Deleted meanwhile: close the editor rather than offer a retry.
            setEditing((cur) => (cur?.id === bet.id ? (fresh.deletedAt ? null : fresh) : cur));
          }
          setEditStatus({ tone: 'err', text: errText(e, savage) });
        },
      },
    );
  };

  const act = (bet: BetRecord, patch: BetPatch) => {
    setCardError(null);
    cardUpdate.mutate({ bet, patch }, { onError: (e) => setCardError({ id: bet.id, text: errText(e, savage) }) });
  };

  // Any card write in flight disables every card's actions (see cardUpdate),
  // and a bet open in the form can't be acted on mid-save.
  const busy = (id: string) => cardUpdate.isPending || (update.isPending && update.variables?.bet.id === id);

  const actions = ({ bet, outcome }: BoardEntry) => {
    const btn = (label: string, onClick: () => void) => (
      <button
        key={label}
        type="button"
        className={styles.act}
        onClick={onClick}
        disabled={busy(bet.id)}
      >
        {label}
      </button>
    );

    const out = [];
    // Unpaid: the ruling can still be overturned. Paid: only the payout can
    // be undone here (overturning a paid bet is a two-step on purpose).
    if (outcome.kind === 'settled' && !outcome.paid) out.push(btn(savage ? 'OVERTURN' : 'UNDO', () => act(bet, { winner: null })));
    if (outcome.kind === 'settled' && outcome.paid) out.push(btn('UNDO PAID', () => act(bet, { paid: false })));
    out.push(
      btn('EDIT', () => {
        setEditStatus(null);
        setEditing(bet);
      }),
    );
    out.push(
      btn('DELETE', () => {
        const ok = window.confirm(
          savage ? 'Delete this bet? Everyone will see you did it.' : 'Delete this bet? It disappears from the board.',
        );
        if (ok) act(bet, { deleted: true });
      }),
    );
    return out;
  };

  // The ruling lives under each team, so the label never carries a long name.
  const pick = ({ bet, outcome }: BoardEntry) =>
    outcome.kind === 'settled'
      ? undefined
      : (side: 'A' | 'B') => (
          <button
            type="button"
            className={styles.pick}
            onClick={() => act(bet, { winner: side })}
            disabled={busy(bet.id)}
            aria-label={`${view(side === 'A' ? bet.sideA : bet.sideB).name} won`}
          >
            WINNER ✓
          </button>
        );

  // Owed bets get one big obvious button: the debt is the point of the card.
  const settle = ({ bet, outcome }: BoardEntry) =>
    outcome.kind === 'settled' && !outcome.paid ? (
      <button type="button" className={styles.payBtn} onClick={() => act(bet, { paid: true })} disabled={busy(bet.id)}>
        {savage ? 'MARK PAID 🍺' : 'MARK PAID'}
      </button>
    ) : undefined;

  const card = (e: BoardEntry) => (
    <div key={e.bet.id} className={styles.cardCell}>
      <BetCard
        bet={e.bet}
        a={view(e.bet.sideA)}
        b={view(e.bet.sideB)}
        scores={e.scores}
        outcome={e.outcome}
        savage={savage}
        thisWeek={e.bet.week === liveWeek && league?.status === 'in_season'}
        pick={pick(e)}
        settle={settle(e)}
        actions={actions(e)}
      />
      {cardError?.id === e.bet.id && <div className={`${styles.status} ${styles.statusError} ${styles.cardError}`}>{cardError.text}</div>}
    </div>
  );

  const defaultWeek = Math.max(1, Math.min(17, liveWeek));
  // Every way out of the editor (Esc, backdrop, CANCEL) waits for a save in
  // flight, so its result can't land in a different bet's editor.
  const closeEditor = () => {
    if (!update.isPending) setEditing(null);
  };
  const nameOf = (id: string) => view(id).name;
  const shown = board ? filterBoard(board.bets, filter, who) : [];

  // Click a header to sort by it; click again to flip. Name starts A→Z,
  // numbers start biggest-first.
  const head = (key: RecordSortKey, label: string, title?: string) => {
    const on = sort.key === key;
    return (
      <th aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={key === 'name' ? styles.thName : undefined}>
        <button
          type="button"
          title={title}
          className={on ? `${styles.sortBtn} ${styles.sortOn}` : styles.sortBtn}
          onClick={() =>
            setSort(on ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' })
          }
        >
          {label}
          <span className={styles.sortArrow} aria-hidden>
            {on ? (sort.dir === 'asc' ? '▲' : '▼') : '▼'}
          </span>
        </button>
      </th>
    );
  };

  const FILTERS: Array<[BoardFilter, string]> = [
    ['all', 'ALL'],
    ['pending', 'PENDING'],
    ['unpaid', savage ? 'PAY UP' : 'UNPAID'],
    ['paid', 'PAID ✓'],
  ];

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>The Betting Board</PageTitle>
        <span className={styles.note}>{savage ? 'LOSER BUYS. NO WELSHING.' : 'SIDE BETS, ON THE RECORD.'}</span>
      </div>

      <div className={styles.grid}>
        <BetForm
          key={`new-${season}-${formKey}`}
          season={season}
          defaultWeek={defaultWeek}
          managers={managers}
          editing={null}
          onCancelEdit={() => {}}
          onCreate={onCreate}
          onEdit={onEdit}
          pending={create.isPending}
          status={status}
          savage={savage}
        />

        <Panel label={savage ? 'BET RECORD · WHO CASHES' : 'BET RECORD'}>
          {!board ? (
            <span className={styles.dim}>{bets.isError ? '—' : 'running the numbers…'}</span>
          ) : board.record.length === 0 ? (
            <span className={styles.dim}>
              {savage ? 'No bets on the books. Everyone is still undefeated and insufferable.' : 'No bets on the books yet.'}
            </span>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {head('name', 'MANAGER')}
                    {head('won', 'W', 'Bets won')}
                    {head('lost', 'L', 'Bets lost')}
                    {head('pct', 'WIN%', 'Won ÷ decided')}
                    {head('open', 'OPEN', 'Still pending')}
                    {head('owes', 'OWES', 'Lost and not paid yet')}
                  </tr>
                </thead>
                <tbody>
                  {sortRecord(board.record, sort, nameOf).map((r) => {
                    const v = view(r.ownerId);
                    const pct = winPct(r);
                    const on = who === r.ownerId;
                    return (
                      <tr key={r.ownerId} className={on ? styles.rowOn : undefined}>
                        <td className={styles.tdName}>
                          {/* The name doubles as the board's manager filter. */}
                          <button
                            type="button"
                            className={styles.who}
                            aria-pressed={on}
                            title={on ? 'Show everyone’s bets' : `Show only ${v.name}’s bets`}
                            onClick={() => setWho(on ? null : r.ownerId)}
                          >
                            <TeamAvatar src={v.avatar} size={22} />
                            <span className={styles.whoName}>{v.name}</span>
                          </button>
                        </td>
                        <td className={`uMono ${styles.won}`}>{r.won.length}</td>
                        <td className={`uMono ${styles.lost}`}>{r.lost.length}</td>
                        <td className="uMono">{pct === null ? '—' : `${fmt0(pct * 100)}%`}</td>
                        <td className={`uMono ${styles.openCol}`}>{r.open.length}</td>
                        <td className={`uMono ${r.owes.length ? styles.owes : styles.openCol}`}>{r.owes.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {bets.isError ? (
        <div className={styles.week}>
          <EmptyState title={savage ? "The bookie's not answering" : "Couldn't load bets"}>
            {savage ? 'The board is down. Your debts are not.' : 'The betting board is unavailable right now — try again shortly.'}
          </EmptyState>
        </div>
      ) : !board || weeks.isLoading ? (
        <LoadingQuip text="checking the books…" />
      ) : board.bets.length === 0 ? (
        <div className={styles.week}>
          <EmptyState title={savage ? 'No action this season' : 'No bets yet'}>
            {savage ? 'Not a single bet. Cowards, all fourteen of you.' : 'Nobody has placed a bet this season. Add one above.'}
          </EmptyState>
        </div>
      ) : (
        <section className={styles.week}>
          <div className={styles.boardHead}>
            <SectionLabel>{savage ? 'THE ACTION' : 'ALL BETS'}</SectionLabel>
            <div className={styles.filters} role="group" aria-label="Filter bets">
              {FILTERS.map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  className={filter === f ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  onClick={() => setFilter(f)}
                >
                  {label}
                </button>
              ))}
              {who && (
                <button type="button" className={`${styles.chip} ${styles.chipOn}`} onClick={() => setWho(null)}>
                  {nameOf(who).toUpperCase()} ✕
                </button>
              )}
            </div>
          </div>
          {weeks.isError && (
            // Scores are context only, so a Sleeper outage mustn't take the
            // board down; it must just not pass "no score" off as real.
            <p className={styles.hint} role="status">
              {savage
                ? "Sleeper isn't answering, so no scores on the cards. The bets still count."
                : 'Scores are unavailable right now — Sleeper did not respond. Bets are unaffected.'}
            </p>
          )}
          {shown.length === 0 ? (
            <p className={styles.dim}>
              {savage ? 'Nothing matches. The bookie is as bored as you are.' : 'No bets match this filter.'}
            </p>
          ) : (
            <div className={styles.cards}>{shown.map(card)}</div>
          )}
        </section>
      )}

      {/* Editing happens in place, over the board — not back up in the booking form. */}
      <Modal open={!!editing} onClose={closeEditor} label="Edit bet">
        {editing && (
          <BetForm
            key={editing.id}
            season={season}
            defaultWeek={defaultWeek}
            managers={managers}
            editing={editing}
            onCancelEdit={closeEditor}
            onCreate={onCreate}
            onEdit={onEdit}
            pending={update.isPending}
            status={editStatus}
            savage={savage}
          />
        )}
      </Modal>

    </div>
  );
}
