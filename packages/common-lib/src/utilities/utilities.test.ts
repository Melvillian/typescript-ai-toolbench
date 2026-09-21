import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  errorToString,
  filter,
  isEmpty,
  pick,
  sleep,
  toCamelCase,
} from '../index.js';

describe('errorToString', () => {
  it('serializes non-enumerable Error properties', () => {
    const parsed = JSON.parse(errorToString(new Error('boom'))) as {
      message: string;
      stack: string;
    };
    expect(parsed.message).toBe('boom');
    expect(parsed.stack).toContain('boom');
  });
});

describe('pick', () => {
  it('copies only the requested keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });
});

describe('filter', () => {
  it('keeps entries whose value passes the condition', () => {
    expect(filter({ a: 1, b: 2, c: 3 }, (value) => value > 1)).toEqual({
      b: 2,
      c: 3,
    });
  });
});

describe('isEmpty', () => {
  it('detects objects with no own keys', () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});

describe('sleep', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the rounded duration', async () => {
    vi.useFakeTimers();
    let resolved = false;
    const pending = sleep(99.6).then(() => {
      resolved = true;
      return undefined;
    });

    await vi.advanceTimersByTimeAsync(99);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });
});

describe('toCamelCase', () => {
  it('returns an empty string unchanged', () => {
    expect(toCamelCase('')).toBe('');
  });
});
