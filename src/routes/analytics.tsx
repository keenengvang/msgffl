import { createFileRoute } from '@tanstack/react-router';
import { AnalyticsPage } from '@/pages/analytics/ui/AnalyticsPage';

export const Route = createFileRoute('/analytics')({ component: AnalyticsPage });
