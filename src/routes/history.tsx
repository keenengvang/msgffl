import { createFileRoute } from '@tanstack/react-router';
import { HistoryPage } from '@/pages/history/ui/HistoryPage';

export const Route = createFileRoute('/history')({ component: HistoryPage });
