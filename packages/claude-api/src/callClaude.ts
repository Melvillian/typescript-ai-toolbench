import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '@melvillian/common-lib';
import 'dotenv/config';

import { MissingApiKeyError } from './errors.js';

import type {
  MessageParam,
  Tool,
  Message,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages';

export interface CallClaudeOptions {
  system: string;
  messages: MessageParam[];
  model?: string;
  tools?: Tool[];
  maxTokens?: number;
  apiKey?: string;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_TOKENS = 4096;

export async function callClaude(options: CallClaudeOptions): Promise<Message> {
  const apiKey = options.apiKey ?? getEnv('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new MissingApiKeyError({
      message:
        'ANTHROPIC_API_KEY missing — set it in .env or pass apiKey in options',
      context: {},
    });
  }

  const client = new Anthropic({ apiKey });

  const params: MessageCreateParamsNonStreaming = {
    model: options.model ?? DEFAULT_MODEL,
    system: options.system,
    messages: options.messages,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  if (options.tools !== undefined) {
    params.tools = options.tools;
  }

  return client.messages.create(params);
}
