import { afterEach, describe, expect, it, vi } from 'vitest';

import hello from './hello.js';

describe('hello command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the greeting', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await hello.parseAsync([], { from: 'user' });

    expect(hello.name()).toBe('hello');
    expect(log).toHaveBeenCalledWith('Hello world!');
  });
});
