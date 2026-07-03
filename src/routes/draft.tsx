import { createFileRoute } from '@tanstack/react-router';
import { DraftPage } from '@/pages/draft/ui/DraftPage';

export const Route = createFileRoute('/draft')({ component: DraftPage });
