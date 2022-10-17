import { setTimeout } from 'node:timers/promises';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { default as logger } from '@synthetixio/core-utils/utils/io/logger';
import { default as prompter } from '@synthetixio/core-utils/utils/io/prompter';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import { readPackageJson } from '@synthetixio/core-utils/utils/misc/npm';
import { ContractValidationError } from '../internal/errors';
import {
  SUBTASK_CANCEL_DEPLOYMENT,
  SUBTASK_CLEAR_DEPLOYMENTS,
  SUBTASK_CREATE_DEPLOYMENT,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_DEPLOY_PROXY,
  SUBTASK_DEPLOY_ROUTER,
  SUBTASK_FINALIZE_DEPLOYMENT,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_LOAD_DEPLOYMENT,
  SUBTASK_PRINT_INFO,
  SUBTASK_SYNC_PROXY,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_UPGRADE_PROXY,
  SUBTASK_VALIDATE_INTERFACES,
  SUBTASK_VALIDATE_MODULES,
  SUBTASK_VALIDATE_ROUTER,
  TASK_DEPLOY,
} from '../task-names';

export interface DeployTaskParams {
  noConfirm?: boolean;
  skipProxy?: boolean;
  debug?: boolean;
  quiet?: boolean;
  clear?: boolean;
  alias?: string;
  modules?: string;
  instance?: string;
}

task(TASK_DEPLOY, 'Deploys all system modules')
  .addFlag('noConfirm', 'Skip all confirmation prompts')
  .addFlag('skipProxy', 'Do not deploy the UUPS proxy')
  .addFlag('debug', 'Display debug logs')
  .addFlag('quiet', 'Silence all output')
  .addFlag('clear', 'Clear all previous deployment data for the selected network')
  .addOptionalParam('alias', 'The alias name for the deployment', undefined, types.alphanumeric)
  .addOptionalPositionalParam(
    'modules',
    'Regex string for which modules are deployed to the router. Leave empty to deploy all modules.'
  )
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .setAction(async (taskArguments: DeployTaskParams, hre) => {
    const { clear, debug, quiet, noConfirm, skipProxy } = taskArguments;

    logger.quiet = !!quiet;
    logger.debugging = !!debug;
    prompter.noConfirm = !!noConfirm;

    // Do not throw an error on missing package.json
    // This is so we don't force the user to have the file on tests just for the name
    try {
      await logger.title(readPackageJson().name);
    } catch (err: unknown) {
      if ((err as { code: string }).code !== 'ENOENT') throw err;
    }

    await logger.title('DEPLOYER');

    try {
      if (clear) {
        await hre.run(SUBTASK_CLEAR_DEPLOYMENTS, taskArguments);
      }

      await hre.run(SUBTASK_CREATE_DEPLOYMENT, taskArguments);
      await hre.run(SUBTASK_LOAD_DEPLOYMENT, taskArguments);
      await _compile(hre, !!quiet);
      await hre.run(SUBTASK_SYNC_SOURCES, taskArguments);
      await hre.run(SUBTASK_SYNC_PROXY);
      await hre.run(SUBTASK_PRINT_INFO, taskArguments);

      // note: temporarily disabled due to library storage refactor
      //await hre.run(SUBTASK_VALIDATE_STORAGE);

      await hre.run(SUBTASK_VALIDATE_MODULES);
      await hre.run(SUBTASK_VALIDATE_INTERFACES);
      await hre.run(SUBTASK_DEPLOY_MODULES);
      await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE);
      await _compile(hre, !!quiet);
      await hre.run(SUBTASK_VALIDATE_ROUTER);
      await hre.run(SUBTASK_DEPLOY_ROUTER);

      if (!skipProxy) {
        await hre.run(SUBTASK_DEPLOY_PROXY);
        await hre.run(SUBTASK_UPGRADE_PROXY);
      }

      await hre.run(SUBTASK_FINALIZE_DEPLOYMENT);
    } catch (err) {
      if (err instanceof ContractValidationError) {
        await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
      }

      throw err;
    } finally {
      // TODO remove autosave object and change it for something more explicit.
      // Make sure that all the changes are persisted to the deployment artifacts
      await setTimeout(1);
    }
  });

/*
 * Note: Even though hardhat's compile task has a quiet option,
 * it still prints some output. This is a hack to completely silence
 * output during compile task run.
 */
async function _compile(hre: HardhatRuntimeEnvironment, quiet: boolean) {
  let logCache;

  if (quiet) {
    logCache = console.log;
    console.log = () => {};
  }

  try {
    await hre.run(TASK_COMPILE, { force: true, quiet: true });
  } finally {
    if (logCache) console.log = logCache;
  }
}
