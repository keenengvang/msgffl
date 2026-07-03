import { createFileRoute } from '@tanstack/react-router';
import { SuggestPage } from '@/pages/suggest/ui/SuggestPage';

export const Route = createFileRoute('/suggest')({ component: SuggestPage });
