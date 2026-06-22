import { describe, expect, it } from 'vitest';

import { computeBuildOrder, renderBuildScript } from './gen-build-order.mjs';

const ws = (name, base, deps = [], hasBuild = true) => ({
  name,
  base,
  deps,
  hasBuild,
});

describe('computeBuildOrder', () => {
  it('orders dependencies before dependents', () => {
    const order = computeBuildOrder([
      ws('cli', 'apps', ['@scope/lib']),
      ws('@scope/lib', 'packages', []),
    ]).map((w) => w.name);
    expect(order.indexOf('@scope/lib')).toBeLessThan(order.indexOf('cli'));
  });

  it('puts packages before apps within a level, then alphabetical', () => {
    const order = computeBuildOrder([
      ws('api', 'apps', []),
      ws('@scope/b', 'packages', []),
      ws('@scope/a', 'packages', []),
    ]).map((w) => w.name);
    expect(order).toEqual(['@scope/a', '@scope/b', 'api']);
  });

  it('throws on a dependency cycle', () => {
    expect(() =>
      computeBuildOrder([
        ws('@scope/a', 'packages', ['@scope/b']),
        ws('@scope/b', 'packages', ['@scope/a']),
      ]),
    ).toThrow(/cycle/i);
  });
});

describe('renderBuildScript', () => {
  it('chains filters in order and skips workspaces without a build script', () => {
    const script = renderBuildScript([
      ws('@scope/lib', 'packages', [], true),
      ws('docs', 'apps', [], false),
      ws('api', 'apps', [], true),
    ]);
    expect(script).toBe(
      'bun --filter @scope/lib build && bun --filter api build',
    );
  });
});
