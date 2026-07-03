import type { MatchupPair } from './pairMatchups';

export interface WeekTags {
  /** matchup_id of the week's top single score. */
  nuke: number | null;
  /** matchup_id of the biggest margin. */
  blow: number | null;
  /** matchup_id of the smallest nonzero margin. */
  close: number | null;
}

/** Tag the week's standout games. Precedence when rendering a card that
    holds several tags: NUKE > MASSACRE > PHOTO FINISH (legacy order). */
export function weekTags(pairs: MatchupPair[]): WeekTags {
  const played = pairs.some(([a, b]) => (a.p || 0) > 0 || (b.p || 0) > 0);
  const tags: WeekTags = { nuke: null, blow: null, close: null };
  if (!played) return tags;

  let maxMargin = -1;
  let minMargin = Infinity;
  let maxPts = -1;
  pairs.forEach(([a, b]) => {
    const margin = Math.abs(a.p - b.p);
    const top = Math.max(a.p, b.p);
    if (margin > maxMargin) {
      maxMargin = margin;
      tags.blow = a.m;
    }
    if (margin > 0 && margin < minMargin) {
      minMargin = margin;
      tags.close = a.m;
    }
    if (top > maxPts) {
      maxPts = top;
      tags.nuke = a.m;
    }
  });
  return tags;
}
