import fs from 'node:fs';
import path from 'node:path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { resetHardhatContext } from 'hardhat/plugins-testing';
import { TASK_DEPLOY } from '../../src/task-names';
import type { DeployTaskParams } from '../../src/tasks/deploy';

export function loadEnvironment(fixtureProjectName: string, networkName = 'hardhat') {
  resetHardhatContext();

  let envPath = fixtureProjectName;
  if (fixtureProjectName.includes('/')) {
    envPath = fixtureProjectName;
  } else {
    envPath = _getEnvironmentPath(fixtureProjectName);
  }

  process.chdir(envPath);
  process.env.HARDHAT_NETWORK = networkName;

  return require('hardhat');
}

export async function deployOnEnvironment(
  hre: HardhatRuntimeEnvironment,
  customOptions: DeployTaskParams = {}
) {
  const deploymentInfo = {
    network: hre.config.defaultNetwork,
    instance: 'test',
  };

  await hre.run(TASK_DEPLOY, {
    ...deploymentInfo,
    noConfirm: true,
    quiet: true,
    ...customOptions,
  });

  if (customOptions.clear) {
    let initializer;

    try {
      initializer = require(path.join(hre.config.paths.root, 'test', 'helpers', 'initializer'));
    } catch (err) {
      if ((err as { code: string }).code !== 'MODULE_NOT_FOUND') {
        throw err;
      }
    }

    if (initializer) {
      await initializer(deploymentInfo, hre);
    }
  }
}

function _getEnvironmentPath(fixtureProjectName: string) {
  const pathname = path.resolve(__dirname, '..', 'fixture-projects', fixtureProjectName);

  if (!fs.existsSync(pathname)) {
    throw new Error(`Invalid fixture project ${fixtureProjectName}`);
  }

  return pathname;
}
