import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';

export interface MatchupsSearch {
  week?: number;
}

export const Route = createFileRoute('/matchups')({
  validateSearch: (search: Record<string, unknown>): MatchupsSearch => {
    const w = Number(search.week);
    return { week: Number.isInteger(w) && w >= 1 && w <= 17 ? w : undefined };
  },
  component: () => (
    <div className="pageEnter">
      <EmptyState title="Under construction">The matchups page arrives in a later phase.</EmptyState>
    </div>
  ),
});
