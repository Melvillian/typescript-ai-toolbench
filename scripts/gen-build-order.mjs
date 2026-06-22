#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE_BASES = ['packages', 'apps'];

/**
 * Read every workspace package.json under packages/* and apps/*.
 * @returns {{ name: string, base: string, deps: string[], hasBuild: boolean }[]}
 */
export function collectWorkspaces(rootDir) {
  const workspaces = [];
  for (const base of WORKSPACE_BASES) {
    const baseDir = join(rootDir, base);
    if (!existsSync(baseDir)) continue;
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(baseDir, entry.name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (!pkg.name) continue;
      const deps = Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
        ...pkg.optionalDependencies,
      });
      workspaces.push({
        name: pkg.name,
        base,
        deps,
        hasBuild: Boolean(pkg.scripts && pkg.scripts.build),
      });
    }
  }
  return workspaces;
}

/**
 * Deterministic topological sort: dependencies before dependents.
 * Tie-break within a ready frontier: packages before apps, then alphabetical.
 * Throws on a dependency cycle.
 */
export function computeBuildOrder(workspaces) {
  const names = new Set(workspaces.map((w) => w.name));
  const blocking = new Map(
    workspaces.map((w) => [
      w.name,
      new Set(w.deps.filter((d) => names.has(d) && d !== w.name)),
    ]),
  );
  const tieBreak = (a, b) => {
    if (a.base !== b.base) return a.base === 'packages' ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  };
  const placed = new Set();
  const ordered = [];
  while (ordered.length < workspaces.length) {
    const ready = workspaces
      .filter((w) => !placed.has(w.name))
      .filter((w) => [...blocking.get(w.name)].every((d) => placed.has(d)))
      .sort(tieBreak);
    if (ready.length === 0) {
      const remaining = workspaces
        .filter((w) => !placed.has(w.name))
        .map((w) => w.name);
      throw new Error(
        `Dependency cycle detected among: ${remaining.join(', ')}`,
      );
    }
    for (const w of ready) {
      ordered.push(w);
      placed.add(w.name);
    }
  }
  return ordered;
}

/** Render the root build script from an ordered workspace list. */
export function renderBuildScript(ordered) {
  return ordered
    .filter((w) => w.hasBuild)
    .map((w) => `bun --filter ${w.name} build`)
    .join(' && ');
}

function main() {
  const rootDir = process.cwd();
  const ordered = computeBuildOrder(collectWorkspaces(rootDir));
  const script = renderBuildScript(ordered);

  const pkgPath = join(rootDir, 'package.json');
  const original = readFileSync(pkgPath, 'utf8');
  const buildRe = /("build":\s*")(?:[^"\\]|\\.)*(")/;
  if (!buildRe.test(original)) {
    throw new Error('No "build" script found in root package.json');
  }
  const updated = original.replace(buildRe, (_match, p1, p2) => p1 + script + p2);
  if (updated === original) {
    console.log('Build order already up to date.');
    return;
  }
  writeFileSync(pkgPath, updated);
  console.log(`Updated root build order:\n  ${script}`);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
