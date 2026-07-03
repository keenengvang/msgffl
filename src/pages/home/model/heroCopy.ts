import type { StandingRow } from '@/entities/team/model/types';
import type { LeagueStatus } from '@/shared/api/types';

interface HeroInput {
  season: string | undefined;
  status: LeagueStatus | undefined;
  champ: StandingRow | undefined;
  ru: StandingRow | undefined;
  /** Champion has more than one all-time title (unknown until history loads). */
  repeat: boolean;
  savage: boolean;
}

export interface HeroCopy {
  kicker: string;
  a: string;
  b: string;
  sub: string;
}

export function heroCopy({ season, status, champ, ru, repeat, savage }: HeroInput): HeroCopy {
  const complete = status === 'complete';
  const preDraft = status === 'pre_draft' || status === 'drafting';
  return {
    kicker: `${season}${complete ? ' SEASON — FINAL' : preDraft ? ' SEASON — PRE-DRAFT' : ' SEASON — IN PROGRESS'}`,
    a: complete ? 'THE BELT' : preDraft ? 'FOURTEEN EGOS' : 'GAME',
    b: complete ? (repeat ? 'STAYS PUT' : 'CHANGES HANDS') : preDraft ? 'ONE BELT' : 'ON',
    sub:
      champ && ru
        ? savage
          ? `${champ.team} survived a ${champ.w}–${champ.l} regular season, then ran the whole gauntlet. ${ru.team} fell in the final. The other twelve of you watched from the couch you call a roster.`
          : `${champ.team} finished the job in the final against ${ru.team}. A season well played — congratulations to both, condolences to everyone else.`
        : preDraft
          ? `${season} is loading. Rosters are empty, confidence is not. Draft night will fix exactly one of those.`
          : 'The season is live. Set your lineups, mute your excuses.',
  };
}
