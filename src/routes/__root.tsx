import { Outlet, createRootRoute, retainSearchParams } from '@tanstack/react-router';
import { useVibes } from '@/shared/lib/vibes';
import { Ticker } from '@/widgets/ticker/ui/Ticker';
import { Header } from '@/widgets/header/ui/Header';
import { Footer } from '@/widgets/footer/ui/Footer';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';

export interface RootSearch {
  season?: string;
}

export const Route = createRootRoute({
  // NB: the router's search parser JSON-parses values, so ?season=2022 arrives
  // as a number — coerce rather than typeof-check.
  validateSearch: (search: Record<string, unknown>): RootSearch => ({
    season:
      typeof search.season === 'string' || typeof search.season === 'number'
        ? String(search.season)
        : undefined,
  }),
  search: {
    middlewares: [retainSearchParams(['season'])],
  },
  component: RootLayout,
  notFoundComponent: () => (
    <div className="pageWrap">
      <EmptyState title="Fourth and long">
        This page doesn't exist. Much like your team's playoff hopes.
      </EmptyState>
    </div>
  ),
});

function RootLayout() {
  const { motion } = useVibes();
  return (
    <div data-motion={motion ? 'on' : 'off'} style={{ minHeight: '100vh' }}>
      <Ticker />
      <Header />
      <main className="pageWrap">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
