import fs from 'node:fs';
import path from 'node:path';
import { subtask } from 'hardhat/config';
import logger from '@synthetixio/core-utils/utils/io/logger';
import relativePath from '@synthetixio/core-utils/utils/misc/relative-path';
import { generateRouter } from '../internal/generate-router';
import { SUBTASK_GENERATE_ROUTER_SOURCE } from '../task-names';

subtask(
  SUBTASK_GENERATE_ROUTER_SOURCE,
  'Reads deployed modules from the deployment data file and generates the source for a new router contract.'
).setAction(async ({ routerName = 'Router' }, hre) => {
  const routerPath = path.join(hre.config.paths.sources, `${routerName}.sol`);
  const relativeRouterPath = relativePath(routerPath, hre.config.paths.root);
  const modules = Object.values(hre.router.deployment!.general.contracts).filter((c) => c.isModule);

  const contracts = modules.map((c) => ({
    contractName: c.contractName,
    deployedAddress: c.deployedAddress,
    abi: hre.router.deployment!.abis[c.contractFullyQualifiedName],
  }));

  logger.subtitle('Generating router source');
  logger.debug(`location: ${relativeRouterPath} | modules: ${contracts.length}`);

  const template = path.resolve(__dirname, '..', '..', 'templates', 'Router.sol.mustache');

  const generatedSource = generateRouter({
    routerName,
    template,
    contracts,
    functionFilter: hre.config.router.routerFunctionFilter,
  });

  const currentSource = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, 'utf8') : '';
  if (currentSource !== generatedSource) {
    fs.writeFileSync(routerPath, generatedSource);
    logger.success(`Router code generated and written to ${relativeRouterPath}`);
  } else {
    logger.checked('Router source did not change');
  }

  return generatedSource;
});
