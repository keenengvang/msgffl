import { createFileRoute } from '@tanstack/react-router';
import { BracketPage } from '@/pages/bracket/ui/BracketPage';

export const Route = createFileRoute('/bracket')({ component: BracketPage });
