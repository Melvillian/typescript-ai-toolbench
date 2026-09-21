import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const constructorMock = vi.fn();
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } };
    constructor(options: unknown) {
      constructorMock(options);
    }
  },
}));
// Keep a developer's local .env from leaking an OPENAI_API_KEY into the tests.
vi.mock('dotenv/config', () => ({}));

import { summarizeText } from './index.js';

const completion = (content: string | null) => ({
  choices: [{ message: { content } }],
});

describe('summarizeText', () => {
  beforeEach(() => {
    createMock.mockReset();
    constructorMock.mockReset();
    delete process.env['OPENAI_API_KEY'];
  });

  it('rejects empty and whitespace-only text', async () => {
    await expect(summarizeText('')).rejects.toThrow(/cannot be empty/);
    await expect(summarizeText('   ')).rejects.toThrow(/cannot be empty/);
  });

  it('rejects options that fail validation', async () => {
    await expect(
      summarizeText('text', { apiKey: 'k', temperature: 3 }),
    ).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('requires an API key from options or the environment', async () => {
    await expect(summarizeText('text')).rejects.toThrow(
      /API key must be provided/,
    );
  });

  it('falls back to OPENAI_API_KEY and applies default options', async () => {
    process.env['OPENAI_API_KEY'] = 'env-key';
    createMock.mockResolvedValueOnce(completion('short version'));

    await expect(summarizeText('long text')).resolves.toBe('short version');

    expect(constructorMock).toHaveBeenCalledWith({ apiKey: 'env-key' });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: undefined,
      }),
    );
  });

  it('prefers explicit options and embeds the text in the prompt', async () => {
    process.env['OPENAI_API_KEY'] = 'env-key';
    createMock.mockResolvedValueOnce(completion('summary'));

    await summarizeText('the text', {
      apiKey: 'option-key',
      model: 'gpt-4o',
      maxTokens: 50,
      temperature: 0,
    });

    expect(constructorMock).toHaveBeenCalledWith({ apiKey: 'option-key' });
    const request = createMock.mock.calls[0]?.[0] as {
      model: string;
      max_tokens: number;
      temperature: number;
      messages: { role: string; content: string }[];
    };
    expect(request.model).toBe('gpt-4o');
    expect(request.max_tokens).toBe(50);
    expect(request.temperature).toBe(0);
    expect(request.messages[1]?.content).toContain('the text');
  });

  it('throws when OpenAI returns no summary content', async () => {
    createMock.mockResolvedValueOnce(completion(null));
    await expect(summarizeText('text', { apiKey: 'k' })).rejects.toThrow(
      /Failed to generate summary/,
    );

    createMock.mockResolvedValueOnce({ choices: [] });
    await expect(summarizeText('text', { apiKey: 'k' })).rejects.toThrow(
      /Failed to generate summary/,
    );
  });
});
