import { createFileRoute } from '@tanstack/react-router';
import { BetsPage } from '@/pages/bets/ui/BetsPage';

export const Route = createFileRoute('/bets')({ component: BetsPage });
