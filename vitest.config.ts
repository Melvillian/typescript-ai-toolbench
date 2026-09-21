import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// The coverage gate. Every workspace must independently clear this on all four
// metrics; see the "Coverage" section of CLAUDE.md before changing it.
const COVERAGE_THRESHOLD = 95;

// Workspaces are discovered from disk so a new app or package is gated the
// moment it has a src/ directory, with no config edit to forget.
const root = import.meta.dirname;
const allWorkspaces = [
  ...['apps', 'packages'].flatMap((parent) =>
    readdirSync(join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}`),
  ),
  'generators',
].filter((workspace) => existsSync(join(root, workspace, 'src')));

// Fast inner loop: COVERAGE_WORKSPACE=apps/web bun run test:coverage apps/web/
// gates a single workspace. The full run (no env var) is the real gate.
const only = process.env['COVERAGE_WORKSPACE']?.replace(/\/+$/, '');
if (only !== undefined && !allWorkspaces.includes(only)) {
  throw new Error(
    `COVERAGE_WORKSPACE="${only}" is not a workspace with a src/ directory. Expected one of: ${allWorkspaces.join(', ')}`,
  );
}
const workspaces = only === undefined ? allWorkspaces : [only];

const metrics = {
  lines: COVERAGE_THRESHOLD,
  functions: COVERAGE_THRESHOLD,
  branches: COVERAGE_THRESHOLD,
  statements: COVERAGE_THRESHOLD,
};

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: 'v8',
      // AST-based remapping gives istanbul-accurate branch/statement counts at
      // v8 speed (default in vitest 4; opt-in on 3.2).
      experimentalAstAwareRemapping: true,
      // `include` makes files that no test imports count as 0% instead of
      // silently vanishing from the report.
      include: workspaces.map((workspace) => `${workspace}/src/**/*.{ts,tsx}`),
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/src/test/**',
        // Process entrypoints: they only start a server or mount the DOM, and
        // importing them has side effects. Keep logic out of them (apps/* are
        // thin by rule) so this exclusion never hides anything real.
        'apps/*/src/main.{ts,tsx}',
      ],
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: {
        ...metrics,
        // Per-workspace gates, so one well-tested package cannot mask an
        // untested one in the global average.
        ...Object.fromEntries(
          workspaces.map((workspace) => [`${workspace}/src/**`, metrics]),
        ),
      },
    },
    projects: [
      'packages/*',
      'apps/*',
      'generators',
      // The globs above match every direct child of packages/ and apps/, including
      // any non-directory file (e.g. a stray README.md). Vitest would otherwise try to load
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
