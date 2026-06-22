import { afterEach, describe, expect, it } from 'vitest';

import { getEnv, requireEnv } from './env.js';

const KEY = 'COMMON_LIB_ENV_TEST';

afterEach(() => {
  delete process.env[KEY];
});

describe('getEnv', () => {
  it('trims surrounding whitespace and newlines', () => {
    process.env[KEY] = '  secret-value\n';
    expect(getEnv(KEY)).toBe('secret-value');
  });

  it('returns undefined when unset', () => {
    expect(getEnv(KEY)).toBeUndefined();
  });

  it('returns undefined when empty after trim', () => {
    process.env[KEY] = '   ';
    expect(getEnv(KEY)).toBeUndefined();
  });
});

describe('requireEnv', () => {
  it('returns the trimmed value', () => {
    process.env[KEY] = ' abc ';
    expect(requireEnv(KEY)).toBe('abc');
  });

  it('throws naming the missing variable', () => {
    expect(() => requireEnv(KEY)).toThrow(/COMMON_LIB_ENV_TEST/);
  });
});
