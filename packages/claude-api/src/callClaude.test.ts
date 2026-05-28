import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { callClaude } from './callClaude.js';

describe('callClaude', () => {
  beforeEach(() => {
    createMock.mockReset();
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('throws MissingApiKeyErr when no env var and no option', async () => {
    await expect(
      callClaude({ system: 's', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/MissingApiKeyErr/);
  });

  it('uses the default model claude-haiku-4-5', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'test';
    createMock.mockResolvedValueOnce({ content: [], stop_reason: 'end_turn' });

    await callClaude({
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' }),
    );
  });

  it('forwards system, messages, tools, and maxTokens through untouched', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'test';
    createMock.mockResolvedValueOnce({ content: [], stop_reason: 'end_turn' });

    const tools = [
      {
        name: 'do',
        description: 'do',
        input_schema: { type: 'object' as const },
      },
    ];
    await callClaude({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      tools,
      maxTokens: 12345,
      model: 'custom-model',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools,
        max_tokens: 12345,
        model: 'custom-model',
      }),
    );
  });
});
