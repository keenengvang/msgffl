export const LEAGUE_ID = '1180618034447187968';

export const SLEEPER_API = 'https://api.sleeper.app/v1';

/* Sleeper mints a new league_id every season; the header CTA links to the newest
   league in the chain and falls back to this (2026) id before the chain loads. */
export const SLEEPER_LEAGUE_URL = 'https://sleeper.com/leagues';
export const CURRENT_SLEEPER_LEAGUE_ID = '1355188234203701248';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export const POS_COLORS: Record<Position, string> = {
  QB: '#ff4d6d',
  RB: '#00ceb8',
  WR: '#58a7ff',
  TE: '#ffae58',
  K: '#c58fff',
  DEF: '#9aa7c7',
};

export type Snark = 'savage' | 'polite';
