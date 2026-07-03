import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';

export const Route = createFileRoute('/suggest')({
  component: () => (
    <div className="pageEnter">
      <EmptyState title="Under construction">The suggest page arrives in a later phase.</EmptyState>
    </div>
  ),
});
