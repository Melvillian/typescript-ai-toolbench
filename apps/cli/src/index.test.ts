import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createRequireMock = vi.hoisted(() => vi.fn());
vi.mock('module', async (importOriginal) => ({
  ...(await importOriginal<typeof import('module')>()),
  createRequire: createRequireMock,
}));

import { main } from './index.js';

const originalArgv = process.argv;

class ExitError extends Error {}

describe('cli main', () => {
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Halt like the real process.exit would, without killing the test runner.
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(`exit ${String(code)}`);
    });
    createRequireMock.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads the version from package.json and runs the requested command', async () => {
    createRequireMock.mockReturnValue(() => ({ version: '1.2.3' }));
    process.argv = ['node', 'cli', 'hello'];

    const program = await main();

    expect(program.name()).toBe('cli');
    expect(program.version()).toBe('1.2.3');
    expect(log).toHaveBeenCalledWith('Hello world!');
  });

  it('falls back to BUILD_VERSION when package.json cannot be loaded', async () => {
    createRequireMock.mockImplementation(() => {
      throw new Error('no package.json in a single-binary build');
    });
    vi.stubGlobal('BUILD_VERSION', '9.9.9');
    process.argv = ['node', 'cli', 'hello'];

    const program = await main();

    expect(program.version()).toBe('9.9.9');
  });

  it('exits 1 when no version can be determined', async () => {
    createRequireMock.mockImplementation(() => {
      throw new Error('no package.json');
    });
    // No stub: a binary compiled without --define has no BUILD_VERSION
    // variable at all, which is not the same as one holding undefined.
    expect('BUILD_VERSION' in globalThis).toBe(false);

    await expect(main()).rejects.toThrow(ExitError);

    expect(error).toHaveBeenCalledWith(
      'Package info is not valid, version required',
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 when package.json has no version field', async () => {
    createRequireMock.mockReturnValue(() => ({}));

    await expect(main()).rejects.toThrow('exit 1');
  });
});
