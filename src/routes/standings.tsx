import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';

export const Route = createFileRoute('/standings')({
  component: () => (
    <div className="pageEnter">
      <EmptyState title="Under construction">The standings page arrives in a later phase.</EmptyState>
    </div>
  ),
});
