import { createFileRoute } from '@tanstack/react-router';
import { PowerPage } from '@/pages/power/ui/PowerPage';

export const Route = createFileRoute('/power')({ component: PowerPage });
