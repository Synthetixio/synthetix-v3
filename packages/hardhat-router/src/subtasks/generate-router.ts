import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { subtask } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { generateRouter } from '../internal/generate-router';
import { routerFunctionFilter } from '../internal/router-function-filter';
import { contractIsInSources } from '../internal/contract-helper';
import { SUBTASK_GENERATE_ROUTER } from '../task-names';
import { DeployedContractData } from '../types';

interface Params {
  router?: string;
  template?: string;
  contracts: DeployedContractData[];
}

subtask(
  SUBTASK_GENERATE_ROUTER,
  'Reads deployed modules from the deployment data file and generates the source for a new router contract.'
).setAction(
  async (
    { router = 'contracts/Router.sol:Router', template = '', contracts = [] }: Params,
    hre
  ) => {
    const { sourceName, contractName } = parseFullyQualifiedName(router);

    if (!contractIsInSources(router, hre)) {
      throw new Error(`Router contract ${router} must be inside the local sources folder`);
    }

    const routerPath = path.resolve(hre.config.paths.root, sourceName);

    logger.debug(`generated: ${router} | modules: ${contracts.length}`);

    const sourceCode = generateRouter({
      routerName: contractName,
      template,
      contracts,
      functionFilter: routerFunctionFilter,
    });

    await writeFile(routerPath, sourceCode);
    logger.success(`Router code generated and written to ${sourceName}`);

    return {
      location: routerPath,
      sourceCode,
    };
  }
);
