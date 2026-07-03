import { createFileRoute } from '@tanstack/react-router';
import { TeamDetailPage } from '@/pages/team-detail/ui/TeamDetailPage';

export const Route = createFileRoute('/teams/$ownerId')({ component: TeamDetailPage });
