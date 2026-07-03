/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    // unit tests only — e2e/ belongs to Playwright
    include: ['src/**/*.test.ts', 'netlify/**/*.test.ts'],
  },
});
