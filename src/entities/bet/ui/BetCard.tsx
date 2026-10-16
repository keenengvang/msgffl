import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { Badge, type BadgeTone } from '@/shared/ui/Badge/Badge';
import { fmt } from '@/shared/lib/format';
import { BOOKIE } from '@/shared/config/constants';
import { isComplete, isOwed, type BetOutcome, type SideScores } from '../lib/resolveBet';
import type { Bet } from '../model/types';
import styles from './BetCard.module.css';

export interface BetSideView {
  name: string;
  avatar: string;
}

interface BetCardProps {
  bet: Bet;
  a: BetSideView;
  b: BetSideView;
  scores: SideScores;
  outcome: BetOutcome;
  savage: boolean;
  /** The league's current week — flags the card as this week's action. */
  thisWeek?: boolean;
  /** Per-side control (the "won" button), rendered under that team. */
  pick?: (side: 'A' | 'B') => ReactNode;
  /** The payout control (MARK PAID), shown under the verdict while owed. */
  settle?: ReactNode;
  /** Buttons supplied by the page — the card itself is display-only. */
  actions?: ReactNode;
}

const paidOn = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

function verdict(bet: Bet, o: BetOutcome, a: BetSideView, b: BetSideView, savage: boolean): string | null {
  switch (o.kind) {
    case 'settled': {
      const [win, lose] = o.winner === 'A' ? [a, b] : [b, a];
      if (o.paid) {
        return savage
          ? `${win.name} got paid ${paidOn(bet.paidAt)}. Debt cleared, dignity not.`
          : `${win.name} was paid on ${paidOn(bet.paidAt)}.`;
      }
      return savage ? `${lose.name} owes ${win.name}. The clock is ticking.` : `${lose.name} owes ${win.name}.`;
    }
    case 'ruling':
      return savage ? 'Week’s over. Somebody make the call.' : 'The week is over — record who won.';
    case 'live':
      return savage ? 'Live. Sweat it out.' : 'In progress.';
    case 'upcoming':
      return null;
  }
}

/** One side bet: the two teams, the wager and where it stands. */
export function BetCard({ bet, a, b, scores, outcome, savage, thisWeek, pick, settle, actions }: BetCardProps) {
  // Cards share one height, so a long wager is clamped; MORE opens just this one.
  const termsRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = termsRef.current;
    if (el && !open) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [bet.terms, open]);

  // PENDING until someone rules, then PAY UP until the loser pays, then
  // PAID ✓. The line under the bet says which kind of pending.
  const [tone, label]: [BadgeTone, string] = isComplete(outcome)
    ? ['win', 'PAID ✓']
    : isOwed(outcome)
      ? ['red', savage ? 'PAY UP' : 'UNPAID']
      : ['neutral', 'PENDING'];
  // The week's scores are context for the bet, not its result.
  const showScores = (scores.a ?? 0) !== 0 || (scores.b ?? 0) !== 0;
  const winner = outcome.kind === 'settled' ? outcome.winner : null;
  const line = verdict(bet, outcome, a, b, savage);

  const side = (s: BetSideView, key: 'A' | 'B', pts: number | null) => (
    <div className={`${styles.side} ${winner === key ? styles.sideUp : ''}`}>
      <span className={styles.teamTag}>TEAM {key}</span>
      <TeamAvatar src={s.avatar} size={34} className={styles.avatar} />
      <span className={styles.name}>{s.name}</span>
      {showScores && <span className={`uMono ${styles.pts}`}>{fmt(pts)}</span>}
      {pick?.(key)}
    </div>
  );

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <Badge tone={tone}>{label}</Badge>
        <span className={thisWeek ? `${styles.week} ${styles.weekNow}` : styles.week}>
          WEEK <span className="uMono">{bet.week}</span>
          {thisWeek ? ' · THIS WEEK' : ''}
        </span>
      </div>

      <div className={styles.matchup}>
        {side(a, 'A', scores.a)}
        <span className={styles.vs}>VS</span>
        {side(b, 'B', scores.b)}
      </div>

      <p ref={termsRef} className={open ? styles.terms : `${styles.terms} ${styles.termsClamped}`}>
        {bet.terms}
      </p>
      {(clamped || open) && (
        <button type="button" className={styles.more} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'LESS' : 'MORE'}
        </button>
      )}

      {/* Pinned to the bottom so every card's footer lines up. */}
      <div className={styles.foot}>
        {line && <div className={styles.verdict}>{line}</div>}
        {settle && <div className={styles.settle}>{settle}</div>}
        <div className={styles.bottom}>
          <span className={styles.meta}>
            booked by {BOOKIE}
          </span>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </div>
    </article>
  );
}
