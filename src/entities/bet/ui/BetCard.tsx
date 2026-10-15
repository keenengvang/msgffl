import type { ReactNode } from 'react';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { Badge, type BadgeTone } from '@/shared/ui/Badge/Badge';
import { fmt } from '@/shared/lib/format';
import { BOOKIE } from '@/shared/config/constants';
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

function verdict(o: BetOutcome, a: BetSideView, b: BetSideView, savage: boolean): string | null {
  switch (o.kind) {
    case 'settled': {
      const [win, lose] = o.winner === 'A' ? [a, b] : [b, a];
      return savage ? `${win.name} cashes. ${lose.name}, pay up.` : `${win.name} won this one.`;
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
export function BetCard({ bet, a, b, scores, outcome, locked, savage, actions }: BetCardProps) {
  // Two states, nothing more: ruled on → COMPLETED ✓, everything else →
  // PENDING; the line under the bet says which kind of pending.
  // A shredded bet is off the books entirely.
  const [tone, label]: [BadgeTone, string] = bet.deletedAt
    ? ['neutral', savage ? 'SHREDDED' : 'DELETED']
    : isComplete(outcome)
      ? ['win', 'COMPLETED ✓']
      : ['neutral', 'PENDING'];
  // The week's scores are context for the bet, not its result.
  const showScores = (scores.a ?? 0) !== 0 || (scores.b ?? 0) !== 0;
  const winner = outcome.kind === 'settled' ? outcome.winner : null;
  const line = bet.deletedAt ? null : verdict(outcome, a, b, savage);

  const side = (s: BetSideView, key: 'A' | 'B', pts: number | null) => (
    <div className={`${styles.side} ${winner === key ? styles.sideUp : ''}`}>
      <span className={styles.teamTag}>TEAM {key}</span>
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

      <p className={styles.terms}>{bet.terms}</p>
      {line && <div className={styles.verdict}>{line}</div>}

      {actions && <div className={styles.actions}>{actions}</div>}

      <div className={styles.meta}>
        booked by {BOOKIE}
        {bet.deletedAt ? ` · shredded` : ''}
      </div>
    </article>
  );
}
