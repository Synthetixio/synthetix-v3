import path from 'node:path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { getSelectors } from '@synthetixio/core-utils/utils/ethers/contracts';
import { deployedContractHasBytescode } from '@synthetixio/core-utils/utils/ethers/contracts';
import { onlyRepeated } from '@synthetixio/core-utils/utils/misc/array-filters';
import { ContractData } from '../types';

import type { Provider } from '@ethersproject/abstract-provider';

export async function isAlreadyDeployed(
  contractData: ContractData,
  hre: HardhatRuntimeEnvironment,
  provider: Provider
) {
  if (!contractData.deployedAddress) {
    return false;
  }

  const contractArtifacts = await hre.artifacts.readArtifact(
    contractData.contractFullyQualifiedName
  );

  return deployedContractHasBytescode(
    contractData.deployedAddress,
    contractArtifacts.deployedBytecode,
    provider
  );
}

export async function getAllSelectors(
  contractFullyQualifiedNames: string[],
  hre: HardhatRuntimeEnvironment
) {
  const allSelectors = [];

  for (const name of contractFullyQualifiedNames) {
    const { contractName, abi } = await hre.artifacts.readArtifact(name);
    const selectors = await getSelectors(abi, hre.config.router.routerFunctionFilter);

    allSelectors.push(...selectors.map((s) => ({ ...s, contractName })));
  }

  return allSelectors.sort((a, b) => {
    return Number.parseInt(a.selector, 16) - Number.parseInt(b.selector, 16);
  });
}

export async function getModulesSelectors(hre: HardhatRuntimeEnvironment) {
  const contractNames = Object.entries(hre.router.deployment!.general.contracts)
    .filter(([, c]) => c.isModule)
    .map(([name]) => name);

  return await getAllSelectors(contractNames, hre);
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
 * @param {string} contractSourcePath contract path to file, e.g.: contracts/modules/SomeModule.sol
 * @returns {boolean}
 */
export function contractIsInSources(contractSourcePath: string, hre: HardhatRuntimeEnvironment) {
  const source = path.resolve(hre.config.paths.root, contractSourcePath);
  return source.startsWith(`${hre.config.paths.sources}${path.sep}`);
}

/**
 * Get the list of all modules fully qualified names.
 *   e.g.: ['contracts/modules/SomeModule.sol:SomeModule', ...]
 * @param filters RegExp to match for module inclusion
 * @returns {string[]} fqn of all matching modules
 */
export async function getModulesFullyQualifiedNames(filter = /.*/, hre: HardhatRuntimeEnvironment) {
  const names = await hre.artifacts.getAllFullyQualifiedNames();

  return names.filter((name) => {
    const { sourceName } = parseFullyQualifiedName(name);
    return _contractIsModule(sourceName, hre) && name.match(filter);
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
    return _contractIsStorageLibrary(sourceName, hre);
  });
}

function _contractIsModule(contractSourcePath: string, hre: HardhatRuntimeEnvironment) {
  const source = path.resolve(hre.config.paths.root, contractSourcePath);
  return source.startsWith(`${hre.config.router.paths.modules}${path.sep}`);
}

function _contractIsStorageLibrary(contractSourcePath: string, hre: HardhatRuntimeEnvironment) {
  // TODO: really storage lbiraries can be any library that has a `struct Data` but this is an easy way to conform atm
  return contractSourcePath.startsWith('contracts/storage');
}