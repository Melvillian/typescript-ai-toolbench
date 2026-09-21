import { describe, expect, it } from 'vitest';

import { MissingApiKeyError } from './index.js';

describe('MissingApiKeyError', () => {
  it('tags the message and defaults context to an empty object', () => {
    const err = new MissingApiKeyError({ message: 'no key' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('MissingApiKeyErr');
    expect(err.message).toBe('MissingApiKeyErr: no key');
    expect(err.context).toEqual({});
  });

  it('keeps the provided context', () => {
    const err = new MissingApiKeyError({
      message: 'no key',
      context: { envVar: 'ANTHROPIC_API_KEY' },
    });
    expect(err.context).toEqual({ envVar: 'ANTHROPIC_API_KEY' });
  });
});
