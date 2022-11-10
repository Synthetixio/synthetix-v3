import path from 'node:path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { getSelectors } from '@synthetixio/core-utils/utils/ethers/contracts';
import { onlyRepeated } from '@synthetixio/core-utils/utils/misc/array-filters';
import { DeploymentAbis } from '../types';
import { routerFunctionFilter } from './router-function-filter';

export async function getAllSelectors(
  contractFullyQualifiedNames: string[],
  hre: HardhatRuntimeEnvironment
) {
  const allSelectors = [];

  for (const name of contractFullyQualifiedNames) {
    const { contractName, abi } = await hre.artifacts.readArtifact(name);
    const selectors = await getSelectors(abi, routerFunctionFilter);

    allSelectors.push(...selectors.map((s) => ({ ...s, contractName })));
  }

  return allSelectors.sort((a, b) => {
    return Number.parseInt(a.selector, 16) - Number.parseInt(b.selector, 16);
  });
}

interface ContractFunctionSelector {
  name: string;
  selector: string;
  contractName: string;
}

export function findDuplicateSelectors(selectors: ContractFunctionSelector[]) {
  const duplicates = selectors.map((s) => s.selector).filter(onlyRepeated);

  const ocurrences = duplicates.map((duplicate) => {
    const cases = selectors.filter((s) => s.selector === duplicate);
    return {
      fn: cases[0].name,
      selector: duplicate,
      contracts: cases.map((c) => c.contractName),
    };
  });

  return ocurrences.length > 0 ? ocurrences : null;
}

/**
 * Check if the given contract path is inside the sources folder.
 */
export function contractIsInSources(contractSourcePath: string, hre: HardhatRuntimeEnvironment) {
  const source = path.resolve(hre.config.paths.root, contractSourcePath);
  return source.startsWith(`${hre.config.paths.sources}${path.sep}`);
}

/**
 * Get a list of all the contracts fully qualified names that are present on the
 * local contracts/ folder.
 * It can include a whitelist filter by contractName, contractSource,
 * or if its included in a given folder.
 */
export async function getSourcesFullyQualifiedNames(
  hre: HardhatRuntimeEnvironment,
  whitelist: string[] = []
) {
  const contractFullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();

  return contractFullyQualifiedNames.filter((fqName) => {
    const { sourceName, contractName } = parseFullyQualifiedName(fqName);
    if (!contractIsInSources(sourceName, hre)) return false;
    if (whitelist.length > 0) {
      for (const w of whitelist) {
        if (typeof w !== 'string' || !w) throw new Error(`Invalid whitelist item "${w}"`);
        if (w.endsWith('/') && sourceName.startsWith(w)) return true;
        if ([fqName, sourceName, contractName].includes(w)) return true;
      }

      return false;
    }

    return true;
  });
}

/**
 * Get the list of all storage libraries fully qualified names.
 *   e.g.: ['contracts/storage/Storage.sol:Storage', ...]
 * @returns {string[]} fqn of all matching modules
 */
export async function getStorageLibrariesFullyQualifiedNames(hre: HardhatRuntimeEnvironment) {
  const names = await hre.artifacts.getAllFullyQualifiedNames();

  return names.filter((name) => {
    const { sourceName } = parseFullyQualifiedName(name);
    return _contractIsStorageLibrary(sourceName);
  });
}

function _contractIsStorageLibrary(contractSourcePath: string) {
  // TODO: really storage libraries can be any library that has a
  // `struct Data` but this is an easy way to conform atm
  return contractSourcePath.startsWith('contracts/storage/');
}

export async function getSourcesAbis(hre: HardhatRuntimeEnvironment, whitelist: string[] = []) {
  const filtered = await getSourcesFullyQualifiedNames(hre, whitelist);

  const result: DeploymentAbis = {};

  await Promise.all(
    filtered.map(async (fqName) => {
      const { abi } = await hre.artifacts.readArtifact(fqName);
      result[fqName] = abi;
    })
  );

  return result;
}
