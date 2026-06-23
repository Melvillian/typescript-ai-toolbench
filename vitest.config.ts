import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      'packages/*',
      'apps/*',
      // The globs above match every direct child of packages/ and apps/, including
      // non-directory files like apps/CLAUDE.md. Vitest would otherwise try to load
      // those as project config and fail ("No loader configured for .md files").
      '!**/*.md',
      {
        test: {
          include: ['{app,src}/**/*.test.*'],
          environment: 'node',
        },
      },
    ],
  },
});
