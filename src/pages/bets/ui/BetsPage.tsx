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
import { SectionLabel } from '@/shared/ui/SectionLabel/SectionLabel';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { buildBoard, lastScoredWeek, type BoardEntry } from '../model/board';
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
  const [cardError, setCardError] = useState<{ id: string; text: string } | null>(null);
  // The route stays mounted when the header switches seasons; an editor opened
  // on another season's bet must not follow along and PATCH a bet that's no
  // longer on the board. Close it (state adjusted during render, not in an effect).
  const [editSeason, setEditSeason] = useState(season);
  if (editSeason !== season) {
    setEditSeason(season);
    setEditing(null);
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
    return r ? { name: r.owner, avatar: r.avatar } : { name: 'Ex-member', avatar: '' };
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
    setStatus(null);
    if (Object.keys(patch).length === 0) {
      setEditing(null);
      return;
    }
    update.mutate(
      { bet, patch },
      {
        // Functional updates: by the time this lands the user may have opened
        // a different bet — only touch the editor if it's still this one.
        onSuccess: () => {
          setEditing((cur) => (cur?.id === bet.id ? null : cur));
          setStatus({ tone: 'ok', text: savage ? 'Amended. The fine print grows.' : 'Bet updated.' });
        },
        onError: (e) => {
          // Lost a race: point the open editor at the winner's copy so the
          // retry carries the fresh version (the typed fields are kept).
          if (e instanceof BetApiError && e.fresh) {
            const fresh = e.fresh;
            // Shredded meanwhile: close the editor rather than offer a retry.
            setEditing((cur) => (cur?.id === bet.id ? (fresh.deletedAt ? null : fresh) : cur));
          }
          setStatus({ tone: 'err', text: errText(e, savage) });
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

  const actions = ({ bet, outcome, locked }: BoardEntry) => {
    const btn = (label: string, onClick: () => void, tone: 'plain' | 'red' = 'plain') => (
      <button
        key={label}
        type="button"
        className={tone === 'red' ? `${styles.act} ${styles.actRed}` : styles.act}
        onClick={onClick}
        disabled={busy(bet.id)}
      >
        {label}
      </button>
    );
    if (bet.deletedAt) return [btn(savage ? 'UN-SHRED' : 'RESTORE', () => act(bet, { deleted: false }))];

    const out = [];
    const a = view(bet.sideA).name;
    const b = view(bet.sideB).name;
    if (outcome.kind === 'settled') {
      out.push(btn(savage ? 'OVERTURN' : 'UNDO RULING', () => act(bet, { winner: null })));
    } else {
      out.push(btn(`${a.toUpperCase()} WON`, () => act(bet, { winner: 'A' }), 'red'));
      out.push(btn(`${b.toUpperCase()} WON`, () => act(bet, { winner: 'B' }), 'red'));
    }
    if (!locked) {
      out.push(
        btn('EDIT', () => {
          setStatus(null);
          setEditing(bet);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }),
      );
    }
    out.push(
      btn(savage ? 'SHRED' : 'DELETE', () => {
        const ok = window.confirm(
          savage ? 'Shred this bet? Everyone will see you did it.' : 'Delete this bet? It can be restored from the deleted list.',
        );
        if (ok) act(bet, { deleted: true });
      }),
    );
    return out;
  };

  const card = (e: BoardEntry) => (
    <div key={e.bet.id}>
      <BetCard
        bet={e.bet}
        a={view(e.bet.sideA)}
        b={view(e.bet.sideB)}
        scores={e.scores}
        outcome={e.outcome}
        locked={e.locked}
        savage={savage}
        actions={actions(e)}
      />
      {cardError?.id === e.bet.id && <div className={`${styles.status} ${styles.statusError} ${styles.cardError}`}>{cardError.text}</div>}
    </div>
  );

  const defaultWeek = Math.max(1, Math.min(17, liveWeek));

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>The Betting Board</PageTitle>
        <span className={styles.note}>{savage ? 'LOSER BUYS. NO WELSHING.' : 'SIDE BETS, ON THE RECORD.'}</span>
      </div>

      <div className={styles.grid}>
        <BetForm
          key={editing?.id ?? `new-${season}-${formKey}`}
          season={season}
          defaultWeek={defaultWeek}
          managers={managers}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onCreate={onCreate}
          onEdit={onEdit}
          pending={create.isPending || (!!editing && update.isPending)}
          status={status}
          savage={savage}
        />

        <Panel label={savage ? 'BET RECORD · WHO CASHES' : 'BET RECORD'}>
          {!board ? (
            <span className={styles.dim}>{bets.isError ? '—' : 'running the numbers…'}</span>
          ) : board.record.length === 0 ? (
            <span className={styles.dim}>
              {savage ? 'No bets decided yet. Everyone is still undefeated and insufferable.' : 'No bets have been decided yet.'}
            </span>
          ) : (
            <ul className={styles.tab}>
              {board.record.map((r) => {
                const v = view(r.ownerId);
                return (
                  <li key={r.ownerId} className={styles.tabRow}>
                    <TeamAvatar src={v.avatar} size={26} />
                    <span className={styles.tabName}>{v.name}</span>
                    <span className={`uMono ${styles.tabRecord}`}>
                      <span className={styles.won}>{r.won.length}</span>–<span className={styles.lost}>{r.lost.length}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
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
      ) : board.weeks.length === 0 ? (
        <div className={styles.week}>
          <EmptyState title={savage ? 'No action this season' : 'No bets yet'}>
            {savage ? 'Not a single bet. Cowards, all fourteen of you.' : 'Nobody has placed a bet this season. Add one above.'}
          </EmptyState>
        </div>
      ) : (
        board.weeks.map(({ week, entries }) => (
          <section key={week} className={styles.week}>
            <SectionLabel>
              WEEK {week}
              {week === liveWeek && league?.status === 'in_season' ? ' · THIS WEEK' : ''}
            </SectionLabel>
            <div className={styles.cards}>{entries.map(card)}</div>
          </section>
        ))
      )}

      {board && board.shredded.length > 0 && (
        <details className={styles.shredder}>
          <summary className={styles.shredderLabel}>
            {savage ? 'THE SHREDDER' : 'DELETED BETS'} (<span className="uMono">{board.shredded.length}</span>)
          </summary>
          <div className={styles.cards}>{board.shredded.map(card)}</div>
        </details>
      )}
    </div>
  );
}
