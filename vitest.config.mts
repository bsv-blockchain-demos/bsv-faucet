import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Mirrors the "@/*" paths in tsconfig.json.
      { find: /^@\/(.*)$/, replacement: `${root}$1` },
      // The real package throws outside a React Server Components build.
      { find: 'server-only', replacement: `${root}tests/stubs/server-only.ts` }
    ]
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
