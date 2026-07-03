import type { ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'msgffl-query-cache',
});

/** Bump to invalidate every persisted query after a cache-shape change. */
const CACHE_BUSTER = 'v1';

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: Infinity,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          // Persist only successful data; nfl-state is cheap and always refetched.
          shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'nfl-state',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
