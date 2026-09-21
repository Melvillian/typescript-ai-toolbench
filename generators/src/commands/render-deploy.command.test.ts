import { mkdir, mkdtemp, readFile, realpath } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import renderDeploy from './render-deploy.js';

// The command resolves apps/<name> and render.yaml against process.cwd(), so
// each test runs inside its own throwaway repo directory.
describe('render-deploy command', () => {
  const originalCwd = process.cwd();
  let repoDir: string;
  let log: ReturnType<typeof vi.spyOn>;

  const run = (...args: string[]) =>
    renderDeploy.parseAsync(args, { from: 'user' });

  beforeEach(async () => {
    repoDir = await realpath(
      await mkdtemp(join(tmpdir(), 'render-deploy-command-')),
    );
    await mkdir(join(repoDir, 'apps', 'my-service'), { recursive: true });
    process.chdir(repoDir);
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // commander keeps parsed option values on the shared Command instance.
    renderDeploy.setOptionValue('static', undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
  });

  it('writes a Dockerfile and a docker service entry by default', async () => {
    await run('my-service');

    const dockerfile = await readFile(
      join(repoDir, 'apps', 'my-service', 'Dockerfile'),
      'utf-8',
    );
    expect(dockerfile).toContain('CMD ["bun", "apps/my-service/dist/main.js"]');

    const yaml = await readFile(join(repoDir, 'render.yaml'), 'utf-8');
    expect(yaml).toContain(`name: ${basename(repoDir)}-my-service`);
    expect(yaml).toContain('env: docker');
    expect(log).toHaveBeenCalledWith('2. Commit your changes:');
  });

  it('writes only a static site entry with --static', async () => {
    await run('my-service', '--static');

    await expect(
      readFile(join(repoDir, 'apps', 'my-service', 'Dockerfile'), 'utf-8'),
    ).rejects.toThrow();

    const yaml = await readFile(join(repoDir, 'render.yaml'), 'utf-8');
    expect(yaml).toContain('runtime: static');
    expect(log).toHaveBeenCalledWith(
      '2. If this app fetches same-origin /api/* from a sibling web service,',
    );
  });

  it('reports the failure and exits 1 when the app directory is missing', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    await run('does-not-exist');

    expect(error).toHaveBeenCalledWith(
      'Error generating deploy files:',
      expect.anything(),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
