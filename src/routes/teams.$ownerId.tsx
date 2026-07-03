import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';

export const Route = createFileRoute('/teams/$ownerId')({
  component: () => (
    <div className="pageEnter">
      <EmptyState title="Under construction">The team dossier arrives in a later phase.</EmptyState>
    </div>
  ),
});
