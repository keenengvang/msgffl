import { createFileRoute } from '@tanstack/react-router';
import { RulesPage } from '@/pages/rules/ui/RulesPage';

export const Route = createFileRoute('/rules')({ component: RulesPage });
