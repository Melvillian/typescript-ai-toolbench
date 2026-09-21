import { createRequire } from 'module';

import { Command } from 'commander';

import renderDeployCommand from './commands/render-deploy.js';

declare const BUILD_VERSION: string | undefined;
interface PackageJson {
  name?: string;
  version?: string;
}

export const main = async () => {
  let version: string | undefined;

  try {
    const require = createRequire(import.meta.url);
    const packageInfo = require('../package.json') as PackageJson;
    version = packageInfo.version;
  } catch {
    // we assume it failed because bun couldn't find ../package.json and that
    // we're running in a Bun single binary executable, so we use the build variables.
    // typeof, not `!== undefined`: without --define the variable does not
    // exist, and any other read of it throws a ReferenceError.
    if (typeof BUILD_VERSION !== 'undefined') {
      version = BUILD_VERSION;
    }
  }

  if (!version) {
    console.error('Package info is not valid, version required');
    process.exit(1);
  }

  const program = new Command();

  program.name('generator').version(version).showHelpAfterError(true);

  program.addCommand(renderDeployCommand);

  return program.parseAsync(process.argv);
};
