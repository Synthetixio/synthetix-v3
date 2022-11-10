import fs from 'node:fs/promises';
import path, { dirname } from 'node:path';
import hre from 'hardhat';
import { ChainBuilderRuntime } from '@usecannon/builder/dist/src/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { generateRouter } from '../internal/generate-router';
import { routerFunctionFilter } from '../internal/router-function-filter';

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
exports.generate = async function generate(
  runtime: ChainBuilderRuntime,
  routerFqName: string,
  ...contractPaths: string[]
) {
  const { contractName: routerContractName, sourceName: routerSourceName } =
    parseFullyQualifiedName(routerFqName);

  // TODO find an alternative to using runtime.provider for getting contracts addresses
  const addresses = Object.values(runtime.provider.artifacts.contracts!).reduce((a, c) => {
    a[`${c.sourceName}:${c.contractName}`] = c.address;
    return a;
  }, {} as { [contractFqName: string]: string });

  // TODO modify cannon to be able to access the current step and get the required
  //      contracts from the "depends" field, to avoid repetition
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
    routerName: routerContractName,
    functionFilter: routerFunctionFilter,
    contracts,
  });

  const routerPath = path.resolve(hre.config.paths.root, routerSourceName);
  await fs.mkdir(dirname(routerPath), { recursive: true });
  await fs.writeFile(routerPath, generatedSource);

  // need to re-run compile to ensure artifact is available to cannon
  await hre.run('compile');

  return { contracts: {} };
};
