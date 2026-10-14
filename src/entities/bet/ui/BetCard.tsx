import type { ReactNode } from 'react';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { Badge, type BadgeTone } from '@/shared/ui/Badge/Badge';
import { fmt } from '@/shared/lib/format';
import { isComplete, type BetOutcome, type SideScores } from '../lib/resolveBet';
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
  locked: boolean;
  savage: boolean;
  /** Buttons supplied by the page — the card itself is display-only. */
  actions?: ReactNode;
}

function verdict(bet: Bet, o: BetOutcome, a: BetSideView, b: BetSideView, savage: boolean): string | null {
  const [win, lose] = o.kind === 'settled' ? (o.winner === 'A' ? [a, b] : [b, a]) : [null, null];
  switch (o.kind) {
    case 'settled':
      return savage ? `${lose!.name} owes ${win!.name} ${bet.stakes}. Tick tock.` : `${lose!.name} owes ${win!.name} ${bet.stakes}.`;
    case 'push':
      return savage ? 'Dead even. Nobody wins, everybody’s mad.' : 'A tie — nobody owes anything.';
    case 'ruling':
      return savage ? 'Week’s over. Somebody make the call.' : 'The week is over — record who won.';
    case 'unknown':
      return savage ? 'No score to settle it. Suspicious.' : 'No score available to settle this one.';
    case 'live':
      if (bet.terms.kind === 'custom') return savage ? 'Live. Sweat it out.' : 'In progress.';
      if (!o.leader) return savage ? 'Dead even. Nobody breathe.' : 'All square right now.';
      return `${(o.leader === 'A' ? a : b).name} ${savage ? 'is pouring right now' : 'leads'}.`;
    case 'upcoming':
      return null;
  }
}

/** One side bet: the two managers, the stakes, the terms and where it stands. */
export function BetCard({ bet, a, b, scores, outcome, locked, savage, actions }: BetCardProps) {
  // Two states, nothing more: decided (or a push) → COMPLETED ✓, everything
  // else → PENDING; the line under the stakes says which kind of pending.
  // A shredded bet is off the books entirely.
  const done = isComplete(outcome);
  const [tone, label]: [BadgeTone, string] = bet.deletedAt
    ? ['neutral', savage ? 'SHREDDED' : 'DELETED']
    : done
      ? ['win', 'COMPLETED ✓']
      : ['neutral', 'PENDING'];
  const showScores = bet.terms.kind === 'matchup' && ((scores.a ?? 0) !== 0 || (scores.b ?? 0) !== 0);
  const winner = outcome.kind === 'settled' ? outcome.winner : outcome.kind === 'live' ? outcome.leader : null;
  const line = bet.deletedAt ? null : verdict(bet, outcome, a, b, savage);

  const side = (s: BetSideView, key: 'A' | 'B', pts: number | null) => (
    <div className={`${styles.side} ${winner === key ? styles.sideUp : ''}`}>
      <TeamAvatar src={s.avatar} size={34} className={styles.avatar} />
      <span className={styles.name}>{s.name}</span>
      {showScores && <span className={`uMono ${styles.pts}`}>{fmt(pts)}</span>}
    </div>
  );

  return (
    <article className={`${styles.card} ${bet.deletedAt ? styles.shredded : ''}`}>
      <div className={styles.top}>
        <Badge tone={tone}>{label}</Badge>
        {locked && !bet.deletedAt && (
          <span className={styles.lock} title="Kicked off — the wager can't be edited">
            🔒 {savage ? 'LOCKED IN' : 'LOCKED'}
          </span>
        )}
      </div>

      <div className={styles.matchup}>
        {side(a, 'A', scores.a)}
        <span className={styles.vs}>VS</span>
        {side(b, 'B', scores.b)}
      </div>

      <div className={styles.stakes}>{bet.stakes}</div>
      <div className={styles.terms}>
        {bet.terms.kind === 'matchup'
          ? savage
            ? `Higher score in week ${bet.week} wins. Loser pays.`
            : `Higher score in week ${bet.week} wins.`
          : bet.terms.text}
      </div>
      {line && <div className={styles.verdict}>{line}</div>}

      {actions && <div className={styles.actions}>{actions}</div>}

      <div className={styles.meta}>
        booked by {bet.createdBy}
        {bet.updatedBy !== bet.createdBy || bet.updatedAt !== bet.createdAt ? ` · last touched by ${bet.updatedBy}` : ''}
        {bet.deletedBy ? ` · shredded by ${bet.deletedBy}` : ''}
      </div>
    </article>
  );
}
