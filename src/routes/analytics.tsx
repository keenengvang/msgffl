import { createFileRoute } from '@tanstack/react-router';
import { AnalyticsPage } from '@/pages/analytics/ui/AnalyticsPage';
import { parseTab, type AnalyticsTab } from '@/pages/analytics/model/tabs';

export interface AnalyticsSearch {
  tab?: AnalyticsTab;
}

export const Route = createFileRoute('/analytics')({
  validateSearch: (search: Record<string, unknown>): AnalyticsSearch => ({ tab: parseTab(search.tab) }),
  component: AnalyticsPage,
});
