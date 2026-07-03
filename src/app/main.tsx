import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { QueryProvider } from './providers/QueryProvider';
import { VibesProvider } from '@/shared/lib/vibes';

const router = createRouter({ routeTree, scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <VibesProvider>
        <RouterProvider router={router} />
      </VibesProvider>
    </QueryProvider>
  </StrictMode>,
);
