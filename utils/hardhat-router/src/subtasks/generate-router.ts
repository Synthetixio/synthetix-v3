import fs from 'node:fs/promises';
import path from 'node:path';
import { contractIsInSources } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { subtask } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { renderRouter } from '../internal/render-router';
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
    { router = 'contracts/Router.sol:Router', template = undefined, contracts = [] }: Params,
    hre
  ) => {
    const { sourceName, contractName } = parseFullyQualifiedName(router);

    if (!contractIsInSources(router, hre)) {
      throw new Error(`Router contract ${router} must be inside the local sources folder`);
    }

    const routerPath = path.resolve(hre.config.paths.root, sourceName);

    logger.subtitle(`Generating Router: ${router}`);
    logger.log(`Including ${contracts.length} modules:`);
    for (const c of contracts) logger.info(`${c.contractName}: ${c.deployedAddress}`);

    const sourceCode = renderRouter({
      routerName: contractName,
      template,
      contracts,
    });

    await fs.mkdir(path.dirname(routerPath), { recursive: true });
    await fs.writeFile(routerPath, sourceCode);

    logger.success(`Router code written to ${routerPath}`);

    return {
      location: routerPath,
      sourceCode,
    };
  }
);
