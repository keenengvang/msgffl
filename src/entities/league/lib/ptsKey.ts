import type { League } from '@/shared/api/types';

export type PtsKey = 'pts_ppr' | 'pts_half_ppr' | 'pts_std';

/** Scoring key auto-detected from the league's reception scoring. */
export function ptsKey(lg: League | undefined): PtsKey {
  const r = lg?.scoring_settings?.rec ?? 1;
  return r >= 1 ? 'pts_ppr' : r > 0 ? 'pts_half_ppr' : 'pts_std';
}
