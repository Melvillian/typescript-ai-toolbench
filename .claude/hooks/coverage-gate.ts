#!/usr/bin/env bun
// Stop hook: blocks the agent from ending its turn while the coverage gate
// (`bun run test:coverage`, thresholds in vitest.config.ts) is failing.
//
// Exit 0 lets the stop proceed; exit 2 blocks it and feeds stderr back to the
// agent. It blocks at most once per stop attempt (`stop_hook_active`), so an
// agent that hits one of the stop-and-ask conditions in CLAUDE.md can still
// end its turn and report to the user.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const TIME_LIMIT_MS = 5 * 60 * 1000;
const GATED_PATH =
  /^((apps|packages)\/[^/]+\/src\/|generators\/src\/|vitest\.config\.ts$)/;

const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();

const run = (cmd: string[], timeout?: number) => {
  const result = Bun.spawnSync(cmd, {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout,
    env: { ...process.env, NO_COLOR: '1', COVERAGE_WORKSPACE: undefined },
  });
  return {
    ok: result.exitCode === 0,
    timedOut: result.exitedDueToTimeout === true,
    output: result.stdout.toString() + result.stderr.toString(),
  };
};

const block = (message: string): never => {
  console.error(message);
  process.exit(2);
};

const input = (await Bun.stdin.json().catch(() => ({}))) as {
  stop_hook_active?: boolean;
};
if (input.stop_hook_active === true) process.exit(0);

// Only gate turns that touched gated code: anything on this branch (committed
// or not) that differs from main, plus untracked files.
const base = run(['git', 'merge-base', 'HEAD', 'main']);
const changed = [
  run(['git', 'diff', '--name-only', base.ok ? base.output.trim() : 'HEAD']),
  run(['git', 'ls-files', '--others', '--exclude-standard']),
]
  .flatMap((result) => result.output.split('\n'))
  .filter((path) => GATED_PATH.test(path));
if (changed.length === 0) process.exit(0);

if (!existsSync(join(root, 'node_modules'))) {
  block(
    'Coverage gate could not run: node_modules is missing. Run `bun install` (see /setup), then `bun run test:coverage`.',
  );
}

const startedAt = Date.now();
// Cross-workspace imports resolve against sibling dist/, so build first.
const build = run(['bun', 'run', 'build'], TIME_LIMIT_MS);
const coverage = build.ok
  ? run(
      ['bun', 'run', 'test:coverage'],
      Math.max(TIME_LIMIT_MS - (Date.now() - startedAt), 1),
    )
  : build;

if (coverage.ok) process.exit(0);

if (coverage.timedOut) {
  block(
    'Coverage gate exceeded the 5 minute limit. This is a stop-and-ask condition (CLAUDE.md > Coverage): do not keep iterating. End your turn and tell the user the coverage run takes longer than 5 minutes, with what you know about why.',
  );
}

if (!build.ok) {
  block(
    `Coverage gate could not run because \`bun run build\` failed:\n\n${build.output.slice(-3000)}`,
  );
}

// Keep the feedback small: failing tests, threshold errors, and the rows of
// the text report that are not fully covered.
const lines = coverage.output.split('\n');
const relevant = lines.filter(
  (line) =>
    /^ERROR: Coverage/.test(line) ||
    /FAIL|AssertionError|Error:/.test(line) ||
    /^File\s+\|/.test(line) ||
    (/\|\s+[\d.]+\s+\|\s+[\d.]+\s+\|/.test(line) &&
      !/\|\s+100\s+\|\s+100\s+\|\s+100\s+\|\s+100\s+\|/.test(line) &&
      // export-only barrels have nothing to cover and report 0/0 as "0"
      !/\|\s+0\s+\|\s+0\s+\|\s+0\s+\|\s+0\s+\|\s+\|?\s*$/.test(line)),
);
block(
  [
    'Coverage gate failed: every workspace needs >= 95% lines, branches, functions, and statements, with all tests passing (`bun run test:coverage`).',
    '',
    ...(relevant.length > 0 ? relevant : lines.slice(-40)),
    '',
    'Write tests for the uncovered code and re-run. Follow the `coverage` skill. Do not lower thresholds, add excludes, or add ignore comments to get past this.',
    'If you have hit a stop-and-ask condition (large effort on coverage tests, coverage not rising, or runs over 5 minutes), end your turn and report the current numbers, what is uncovered, and why.',
  ].join('\n'),
);
