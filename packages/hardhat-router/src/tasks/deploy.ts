import path from 'node:path';
import { task } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { default as logger } from '@synthetixio/core-utils/utils/io/logger';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import { getSourcesFullyQualifiedNames } from '../internal/contract-helper';
import { deployContract, deployContracts } from '../internal/deploy-contract';
import {
  SUBTASK_GENERATE_ROUTER,
  SUBTASK_VALIDATE_INTERFACES,
  SUBTASK_VALIDATE_SELECTORS,
  TASK_DEPLOY,
} from '../task-names';
import { quietCompile } from '../utils/quiet-compile';
import { DeployedContractData } from '../types';

export interface DeployTaskParams {
  debug?: boolean;
  quiet?: boolean;
  modules?: string[];
  router?: string;
  proxy?: string;
  skipProxy?: boolean;
  routerTemplate?: string;
}

export interface DeployTaskResult {
  contracts: { [contractName: string]: DeployedContractData };
}

task(TASK_DEPLOY, 'Deploys the given modules behind a Proxy + Router architecture')
  .addFlag('debug', 'Display debug logs')
  .addFlag('quiet', 'Silence all output')
  .addOptionalPositionalParam(
    'modules',
    `Contract files, names, fully qualified names or folder of contracts to include
       e.g.:
         * All the contracts in a folder: contracts/modules/
         * Contracts by contractName: UpgradeModule,OwnerModule
         * By fullyQualifiedName: contracts/modules/UpgradeModule.sol:UpgradeModule
    `,
    ['contracts/modules/'],
    types.stringArray
  )
  .addOptionalParam(
    'router',
    'Fully qualiefied name of where to save the generated Router contract',
    'contracts/Router.sol:Router'
  )
  .addOptionalParam(
    'proxy',
    'Fully qualiefied name of the existing Proxy contract to use',
    'contracts/Proxy.sol:Proxy'
  )
  .addOptionalParam(
    'routerTemplate',
    'Custom path of template to use for rendering the Router',
    path.resolve(__dirname, '../../templates/Router.sol.mustache')
  )
  .addFlag('skipProxy', 'Do not deploy the UUPS proxy')
  .setAction(async (taskArguments: Required<DeployTaskParams>, hre) => {
    const { debug, quiet, modules, router, proxy, skipProxy, routerTemplate } = taskArguments;

    logger.quiet = !!quiet;
    logger.debugging = !!debug;

    if (_contractName(router) === _contractName(proxy)) {
      throw new Error(
        `Router and Proxy contracts cannot have the same name "${_contractName(proxy)}"`
      );
    }

    const contracts = await getSourcesFullyQualifiedNames(hre, modules);

    await quietCompile(hre, !!quiet);

    // note: temporarily disabled due to library storage refactor
    //await hre.run(SUBTASK_VALIDATE_STORAGE);
    await hre.run(SUBTASK_VALIDATE_SELECTORS, { contracts });
    await hre.run(SUBTASK_VALIDATE_INTERFACES, { contracts });

    const modulesData = await deployContracts(contracts, hre);

    await hre.run(SUBTASK_GENERATE_ROUTER, {
      router,
      template: routerTemplate,
      contracts: modulesData,
    });

    await quietCompile(hre, !!quiet);

    const routerData = await deployContract({ contractFullyQualifiedName: router, hre });

    const deployedContracts = [...modulesData, routerData];

    if (!skipProxy) {
      const proxyData = await deployContract({
        contractFullyQualifiedName: proxy,
        constructorArgs: [routerData.deployedAddress],
        hre,
      });
      deployedContracts.push(proxyData);
    }

    const result: DeployTaskResult = { contracts: {} };

    for (const contractData of deployedContracts) {
      result.contracts[contractData.contractName] = contractData;
    }

    return result;
  });

function _contractName(fqName: string) {
  return parseFullyQualifiedName(fqName).contractName;
}
