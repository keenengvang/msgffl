import { useMemo, useState } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useNflState } from '@/entities/league/api/useNflState';
import { useStandings } from '@/entities/team/api/useStandings';
import { useLiveWeek, useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { liveWeekFor } from '@/entities/matchup/lib/liveWeek';
import { useBets, useCreateBet, useUpdateBet, BetApiError } from '@/entities/bet/api/useBets';
import { isPaid, weekIsFinal } from '@/entities/bet/lib/resolveBet';
import type { BetDraft, BetPatch, BetRecord } from '@/entities/bet/model/types';
import { BetCard, type BetSideView } from '@/entities/bet/ui/BetCard';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { Panel } from '@/shared/ui/Panel/Panel';
import { SectionLabel } from '@/shared/ui/SectionLabel/SectionLabel';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { buildBoard, type BoardEntry } from '../model/board';
import { useBetCreds } from '../model/useBetCreds';
import { BetForm } from './BetForm';
import styles from './BetsPage.module.css';

type Status = { tone: 'ok' | 'err'; text: string } | null;

const errText = (e: unknown, savage: boolean) => {
  if (e instanceof BetApiError) {
    if (e.status === 401) return savage ? 'Wrong PIN. Nice try.' : 'That PIN is wrong.';
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
  const liveWeek = liveWeekFor({
    status: league?.status,
    playoffWeekStart: pws,
    nflSeason: nflState.data?.season,
    nflWeek: nflState.data?.week,
    season,
  });
  const weeks = useSeasonWeeks(league);
  const live = useLiveWeek(league, liveWeek);
  const bets = useBets(season);
  const create = useCreateBet();
  const update = useUpdateBet();
  const { creds, set: setCreds, ready } = useBetCreds();

  const [editing, setEditing] = useState<BetRecord | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [status, setStatus] = useState<Status>(null);
  const [cardError, setCardError] = useState<{ id: string; text: string } | null>(null);

  const board = useMemo(() => {
    if (!bets.data || !standings || !season) return null;
    const rosterOf: Record<string, number> = {};
    standings.forEach((r) => (rosterOf[r.ownerId] = r.rosterId));
    return buildBoard(bets.data, {
      rosterOf,
      // The live week polls on its own; the 17-week bundle covers the rest.
      rowsFor: (w) => (w === liveWeek && live.data?.length ? live.data : weeks.data?.[w]),
      isFinal: (w) =>
        weekIsFinal({ status: league?.status, season, nflSeason: nflState.data?.season, nflWeek: nflState.data?.week }, w),
    });
  }, [bets.data, standings, season, liveWeek, live.data, weeks.data, league?.status, nflState.data]);

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
      { draft, creds },
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
      { bet, patch, creds },
      {
        onSuccess: () => {
          setEditing(null);
          setStatus({ tone: 'ok', text: savage ? 'Amended. The fine print grows.' : 'Bet updated.' });
        },
        onError: (e) => {
          // Lost a race: point the open editor at the winner's copy so the
          // retry carries the fresh version (the typed fields are kept).
          if (e instanceof BetApiError && e.fresh) setEditing(e.fresh);
          setStatus({ tone: 'err', text: errText(e, savage) });
        },
      },
    );
  };

  const act = (bet: BetRecord, patch: BetPatch) => {
    setCardError(null);
    if (!ready) {
      setCardError({ id: bet.id, text: savage ? 'Pick your name and enter the PIN up top first.' : 'Enter your name and the league PIN in the form first.' });
      return;
    }
    update.mutate({ bet, patch, creds }, { onError: (e) => setCardError({ id: bet.id, text: errText(e, savage) }) });
  };

  const busy = (id: string) => update.isPending && update.variables?.bet.id === id;

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
    if (bet.terms.kind === 'custom' && outcome.kind !== 'settled') {
      out.push(btn(`${a.toUpperCase()} WON`, () => act(bet, { winner: 'A' })));
      out.push(btn(`${b.toUpperCase()} WON`, () => act(bet, { winner: 'B' })));
    }
    if (outcome.kind === 'settled') {
      const paid = isPaid(bet, outcome);
      out.push(
        paid
          ? btn(savage ? 'UN-PAY (LIAR)' : 'MARK UNPAID', () => act(bet, { paidTo: null }))
          : btn(savage ? 'PAID UP' : 'MARK PAID', () => act(bet, { paidTo: outcome.winner }), 'red'),
      );
      if (bet.terms.kind === 'custom' && !paid) out.push(btn(savage ? 'OVERTURN' : 'UNDO RULING', () => act(bet, { winner: null })));
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
          key={editing?.id ?? `new-${formKey}`}
          season={season}
          defaultWeek={defaultWeek}
          managers={managers}
          creds={creds}
          setCreds={setCreds}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onCreate={onCreate}
          onEdit={onEdit}
          pending={create.isPending || (!!editing && update.isPending)}
          status={status}
          savage={savage}
        />

        <Panel label={savage ? 'THE TAB · WHO OWES WHAT' : 'OUTSTANDING DEBTS'}>
          {!board ? (
            <span className={styles.dim}>{bets.isError ? '—' : 'running the numbers…'}</span>
          ) : board.tab.length === 0 ? (
            <span className={styles.dim}>
              {savage ? 'Nobody owes anybody. Suspiciously honest league.' : 'All square — no unpaid bets.'}
            </span>
          ) : (
            <ul className={styles.tab}>
              {board.tab.map((r) => {
                const v = view(r.ownerId);
                return (
                  <li key={r.ownerId} className={styles.tabRow}>
                    <TeamAvatar src={v.avatar} size={26} />
                    <span className={styles.tabName}>{v.name}</span>
                    <span className={styles.tabDebts}>
                      {r.owes.length > 0 && (
                        <span className={styles.owes}>
                          OWES <span className="uMono">{r.owes.length}</span>
                        </span>
                      )}
                      {r.owed.length > 0 && (
                        <span className={styles.owed}>
                          OWED <span className="uMono">{r.owed.length}</span>
                        </span>
                      )}
                    </span>
                    {r.owes.length > 0 && (
                      <span className={styles.tabStakes}>{r.owes.map((b) => `${b.stakes} → ${view(b.sideA === r.ownerId ? b.sideB : b.sideA).name}`).join(' · ')}</span>
                    )}
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
