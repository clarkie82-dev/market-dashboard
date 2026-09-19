import { defineConfig } from 'vite';

/** Builds via C:\\mdash junction: preserve symlink path so Rollup chunk names stay valid. */
export default defineConfig({
  root: process.cwd(),
  base: '/market-dashboard/',
  resolve: {
    preserveSymlinks: true,
  },
});
