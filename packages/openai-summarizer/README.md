# @melvillian/openai-summarizer

Summarizes text with the OpenAI Chat Completions API.

```ts
import { summarizeText } from '@melvillian/openai-summarizer';

const summary = await summarizeText(longText, { model: 'gpt-4o-mini' });
```

Options: `apiKey` (falls back to `OPENAI_API_KEY`, loaded from `.env` via
`dotenv`), `model` (default `gpt-4o-mini`), `maxTokens`, and `temperature`
(0–2, default 0.7). Throws on empty input, a missing API key, or an empty
completion.

## Tests

`bun --filter @melvillian/openai-summarizer test` runs this package's Vitest
suite; the OpenAI client is mocked, so no API key or network is needed. The
repo-wide coverage gate is `bun run test:coverage` from the root.
