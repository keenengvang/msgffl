import { createFileRoute } from '@tanstack/react-router';
import { PlayersPage } from '@/pages/players/ui/PlayersPage';

const POS_FILTERS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
export type PosFilter = (typeof POS_FILTERS)[number];

export interface PlayersSearch {
  q?: string;
  pos?: PosFilter;
}

export const Route = createFileRoute('/players')({
  validateSearch: (search: Record<string, unknown>): PlayersSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    pos: POS_FILTERS.includes(search.pos as PosFilter) && search.pos !== 'ALL' ? (search.pos as PosFilter) : undefined,
  }),
  component: PlayersPage,
});
