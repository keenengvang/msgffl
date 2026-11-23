import { Outlet, createRootRoute, retainSearchParams, useRouterState } from '@tanstack/react-router';
import { useVibes } from '@/shared/lib/vibes';
import { Ticker } from '@/widgets/ticker/ui/Ticker';
import { Header } from '@/widgets/header/ui/Header';
import { Footer } from '@/widgets/footer/ui/Footer';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { useLeagueChain } from '@/entities/league/api/useLeagueChain';
import { ChatBot } from '@/widgets/chatbot/ui/ChatBot';

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

/** Routes that never read the season chain, so a failed chain must not blank them. */
const CHAIN_FREE = ['/weekly-summary'];

function RootLayout() {
  const { motion } = useVibes();
  const chain = useLeagueChain();
  const path = useRouterState({ select: (st) => st.location.pathname });
  // Every season page waits on the chain. A chain that failed with nothing to
  // show (fetchChain rejects a failed discovery) would leave each page on its
  // loader forever, so the failure is shown once, here, with a retry.
  const chainDown = !!chain.error && !chain.data && !CHAIN_FREE.some((p) => path.startsWith(p));
  return (
    <div data-motion={motion ? 'on' : 'off'} style={{ minHeight: '100vh' }}>
      <Ticker />
      <Header />
      <main className="pageWrap">
        {chainDown ? <ErrorPanel error={chain.error} onRetry={() => void chain.refetch()} /> : <Outlet />}
      </main>
      <ChatBot />
      <Footer />
    </div>
  );
}
