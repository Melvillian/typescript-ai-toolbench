export interface TaggedErrorOptions {
  message: string;
  context?: Record<string, unknown>;
}

export class MissingApiKeyError extends Error {
  override readonly name = 'MissingApiKeyErr';
  readonly context: Record<string, unknown>;
  constructor(opts: TaggedErrorOptions) {
    super(`MissingApiKeyErr: ${opts.message}`);
    this.context = opts.context ?? {};
  }
}
