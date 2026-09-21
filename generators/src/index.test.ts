import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createRequireMock = vi.hoisted(() => vi.fn());
vi.mock('module', async (importOriginal) => ({
  ...(await importOriginal<typeof import('module')>()),
  createRequire: createRequireMock,
}));

const renderDeployAction = vi.hoisted(() => vi.fn());
// Swap the real command (which writes files) for a stub that records the call.
vi.mock('./commands/render-deploy.js', () => ({
  default: new Command('render-deploy')
    .argument('<app-name>')
    .action(renderDeployAction),
}));

import { main } from './index.js';

const originalArgv = process.argv;

class ExitError extends Error {}

describe('generator main', () => {
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Halt like the real process.exit would, without killing the test runner.
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(`exit ${String(code)}`);
    });
    createRequireMock.mockReset();
    renderDeployAction.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads the version from package.json and runs the requested command', async () => {
    createRequireMock.mockReturnValue(() => ({ version: '1.2.3' }));
    process.argv = ['node', 'generator', 'render-deploy', 'my-app'];

    const program = await main();

    expect(program.name()).toBe('generator');
    expect(program.version()).toBe('1.2.3');
    expect(renderDeployAction).toHaveBeenCalledOnce();
    expect(renderDeployAction.mock.calls[0]?.[0]).toBe('my-app');
  });

  it('falls back to BUILD_VERSION when package.json cannot be loaded', async () => {
    createRequireMock.mockImplementation(() => {
      throw new Error('no package.json in a single-binary build');
    });
    vi.stubGlobal('BUILD_VERSION', '9.9.9');
    process.argv = ['node', 'generator', 'render-deploy', 'my-app'];

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
