/**
 * Read an environment variable, trimmed. Returns undefined when the variable is
 * unset or empty after trimming. Trimming once here prevents a trailing newline
 * pasted into a dashboard from leaking into an API header (e.g. 401 invalid key).
 */
export function getEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Like {@link getEnv}, but throws if the variable is missing or empty.
 */
export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (value === undefined) {
    throw new Error(
      `Required environment variable ${name} is missing or empty`,
    );
  }
  return value;
}
