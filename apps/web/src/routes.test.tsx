import { describe, expect, it } from 'vitest';

import { router } from './routes';

describe('router', () => {
  it('mounts Home at the index and About at /about under the App shell', () => {
    const [shell] = router.routes;

    expect(router.routes).toHaveLength(1);
    expect(shell?.path).toBe('/');
    expect(shell?.children?.map((route) => route.path ?? 'index')).toEqual([
      'index',
      'about',
    ]);
  });
});
