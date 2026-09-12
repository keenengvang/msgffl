import { createFileRoute } from '@tanstack/react-router';
import { MatchupDetailPage } from '@/pages/matchup-detail/ui/MatchupDetailPage';

export const Route = createFileRoute('/matchups_/$week/$matchupId')({ component: MatchupDetailPage });
