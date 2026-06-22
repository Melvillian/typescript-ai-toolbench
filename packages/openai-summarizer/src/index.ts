import { getEnv } from '@melvillian/common-lib';
import 'dotenv/config';
import OpenAI from 'openai';
import { z } from 'zod';

const SummarizeOptionsSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().default('gpt-4o-mini'),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
});

export type SummarizeOptions = z.infer<typeof SummarizeOptionsSchema>;

/**
 * Summarizes the provided text using OpenAI's API
 * @param text - The text to summarize
 * @param options - Optional configuration for the summarization
 * @param options.apiKey - OpenAI API key (falls back to OPENAI_API_KEY env var if not provided)
 * @param options.model - The OpenAI model to use (default: 'gpt-4o-mini')
 * @param options.maxTokens - Maximum tokens in the response
 * @param options.temperature - Temperature for response generation (0-2, default: 0.7)
 * @returns A promise that resolves to the summarized text
 */
export async function summarizeText(
  text: string,
  options: Partial<SummarizeOptions> = {},
): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text to summarize cannot be empty');
  }

  const validatedOptions = SummarizeOptionsSchema.parse(options);
  const apiKey = validatedOptions.apiKey ?? getEnv('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error(
      'API key must be provided via options.apiKey or OPENAI_API_KEY environment variable',
    );
  }

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: validatedOptions.model,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that creates concise, accurate summaries of text.',
      },
      {
        role: 'user',
        content: `Please summarize the following text:\n\n${text}`,
      },
    ],
    max_tokens: validatedOptions.maxTokens,
    temperature: validatedOptions.temperature,
  });

  const summary = completion.choices[0]?.message.content;
  if (!summary) {
    throw new Error('Failed to generate summary from OpenAI');
  }

  return summary;
}
