# @melvillian/claude-api

## Overview

Generic wrapper around @anthropic-ai/sdk. Callers pass their own system prompt, messages, and tools.
API key resolved from options or ANTHROPIC_API_KEY env var.

## Commands

- `bun run build` - Compile TypeScript
- `bun run dev` - Watch mode compilation
- `bun run typecheck` - Type check without emitting

## Dependencies

- **@anthropic-ai/sdk** - Official Anthropic SDK
- **dotenv** - Load ANTHROPIC_API_KEY from .env

## Auto-Update Instructions

After changes to files in this directory, run `/update-claude-md`.
