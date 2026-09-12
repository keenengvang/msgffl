export const LEAGUE_ID = '1180618034447187968';

export const SLEEPER_API = 'https://api.sleeper.app/v1';

/* Sleeper mints a new league_id every season; the header CTA links to the newest
   league in the chain and falls back to this (2026) id before the chain loads. */
export const SLEEPER_LEAGUE_URL = 'https://sleeper.com/leagues';
export const CURRENT_SLEEPER_LEAGUE_ID = '1355188234203701248';

/* Where suggestion-box submissions land (GitHub issues, mirrored to Notion). */
export const SUGGESTIONS_URL = 'https://github.com/keenengvang/msgffl/issues?q=is%3Aissue%20label%3Asuggestion';

/* Written by the weekly-summary managed agent via the GitHub MCP toolset —
   fetched raw (not through the GitHub API) so reads stay fast and unauthenticated,
   and a new summary shows up with no rebuild required.
   index.json is the manifest (one entry per week, across every season); the agent
   writes one dated file per week (e.g. 2026-w01.json) plus that manifest entry —
   see content/weekly-summaries/README.md for the exact contract. */
export const WEEKLY_SUMMARY_BASE_URL = 'https://raw.githubusercontent.com/keenengvang/msgffl/main/content/weekly-summaries';
export const WEEKLY_SUMMARY_INDEX_URL = `${WEEKLY_SUMMARY_BASE_URL}/index.json`;

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
