import { createFileRoute } from '@tanstack/react-router';
import { MatchupDetailPage } from '@/pages/matchup-detail/ui/MatchupDetailPage';

export const Route = createFileRoute('/matchups/$week/$matchupId')({ component: MatchupDetailPage });
