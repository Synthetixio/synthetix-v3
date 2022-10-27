import fs from 'node:fs/promises';
import mkdirp from 'mkdirp';
import path, { dirname } from 'node:path';
import hre from 'hardhat';
import { generateRouter } from '../internal/generate-router';

import type { ChainBuilderRuntime } from '@usecannon/builder/dist/src/types';

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
exports.generate = async function generate(
  runtime: ChainBuilderRuntime,
  routerName: string,
  ...contractPaths: string[]
) {
  const addresses = Object.values(runtime.provider.artifacts.contracts!).reduce((a, c) => {
    a[`${c.sourceName}:${c.contractName}`] = c.address;
    return a;
  }, {} as { [contractFqName: string]: string });

  const allContracts = await hre.artifacts.getAllFullyQualifiedNames();
  const normalizedPaths = contractPaths.map((p) => (p.endsWith('/') ? p : `${p}/`));
  const modulesFqNames = normalizedPaths.length
    ? allContracts.filter((c) => normalizedPaths.some((p) => c.startsWith(p)))
    : allContracts;

  const contracts = await Promise.all(
    modulesFqNames.map(async (fqName) => {
      const { contractName, abi } = await runtime.getArtifact(fqName);

      if (!addresses[fqName]) {
        throw new Error(
          `Missing contract address declaration for ${fqName}. You need to add the contract on the "depends" field of the current step.`
        );
      }

      return {
        contractName,
        abi,
        deployedAddress: addresses[fqName],
      };
    })
  );

  const generatedSource = generateRouter({
    routerName,
    functionFilter: hre.config.router.routerFunctionFilter,
    contracts,
  });

  const routerPath = path.join(
    hre.config.paths.sources,
    `routers/chain-${hre.network.config.chainId}`,
    `${routerName}.sol`
  );
  await mkdirp(dirname(routerPath));

  await fs.writeFile(routerPath, generatedSource);

  // need to re-run compile to ensure artifact is available to cannon
  await hre.run('compile');

  return { contracts: {} };
};
