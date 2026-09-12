import { createFileRoute } from '@tanstack/react-router';
import { WeeklySummaryPage } from '@/pages/weekly-summary/ui/WeeklySummaryPage';

export const Route = createFileRoute('/weekly-summary')({ component: WeeklySummaryPage });
