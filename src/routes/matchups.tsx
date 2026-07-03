import { createFileRoute } from '@tanstack/react-router';
import { MatchupsPage } from '@/pages/matchups/ui/MatchupsPage';

export interface MatchupsSearch {
  week?: number;
}

export const Route = createFileRoute('/matchups')({
  validateSearch: (search: Record<string, unknown>): MatchupsSearch => {
    const w = Number(search.week);
    return { week: Number.isInteger(w) && w >= 1 && w <= 17 ? w : undefined };
  },
  component: MatchupsPage,
});
