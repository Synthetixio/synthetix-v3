import fs from 'node:fs';
import path from 'node:path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { resetHardhatContext } from 'hardhat/plugins-testing';

export function loadEnvironment(
  ctx: Mocha.Context,
  fixtureProjectName = path.dirname(require.resolve('@synthetixio/sample-project/package.json')),
  networkName = 'hardhat'
) {
  ctx.timeout(60000);

  resetHardhatContext();

  let envPath = fixtureProjectName;
  if (fixtureProjectName.startsWith('/')) {
    envPath = fixtureProjectName;
  } else {
    envPath = _getEnvironmentPath(fixtureProjectName);
  }

  process.chdir(envPath);
  process.env.HARDHAT_NETWORK = networkName;

  return require('hardhat') as HardhatRuntimeEnvironment;
}

function _getEnvironmentPath(fixtureProjectName: string) {
  const pathname = path.resolve(__dirname, '..', 'fixture-projects', fixtureProjectName);

  if (!fs.existsSync(pathname)) {
    throw new Error(`Invalid fixture project ${fixtureProjectName}`);
  }

  return pathname;
}
