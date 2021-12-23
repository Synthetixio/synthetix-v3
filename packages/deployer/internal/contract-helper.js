const fs = require('fs');
const path = require('path');
const filterValues = require('filter-values');
const { parseName } = require('hardhat/utils/contract-names');
const { getSelectors } = require('@synthetixio/core-js/utils/ethers/contracts');
const { deployedContractHasBytescode } = require('@synthetixio/core-js/utils/ethers/contracts');
const { onlyRepeated } = require('@synthetixio/core-js/utils/misc/array-filters');

async function isAlreadyDeployed(contractName, deploymentData) {
  if (!deploymentData.deployedAddress) {
    return false;
  }

  const contractArtifacts = await hre.artifacts.readArtifact(contractName);

  return deployedContractHasBytescode(
    deploymentData.deployedAddress,
    contractArtifacts.deployedBytecode,
    hre.ethers.provider
  );
}

async function getAllSelectors(contractsFullyQualifiedNames) {
  const allSelectors = [];

  for (const name of contractsFullyQualifiedNames) {
    const { contractName, abi } = await hre.artifacts.readArtifact(name);
    const selectors = await getSelectors(abi);

    allSelectors.push(...selectors.map((s) => ({ ...s, contractName })));
  }

  return allSelectors.sort((a, b) => {
    return Number.parseInt(a.selector, 16) - Number.parseInt(b.selector, 16);
  });
}

async function getModulesSelectors() {
  const contracts = filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule);
  const contractsNames = Object.keys(contracts);
  return await getAllSelectors(contractsNames);
}

function findDuplicateSelectors(selectors) {
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
 * Check if the given contract path is inside the modules folder.
 * @param {string} contractSourcePath contract path to file, e.g.: contracts/modules/SomeModule.sol
 * @returns {boolean}
 */
function contractIsModule(contractSourcePath) {
  const source = path.resolve(hre.config.paths.root, contractSourcePath);
  return source.startsWith(`${hre.config.deployer.paths.modules}${path.sep}`);
}

/**
 * Get contract source path absolute location. Will try to look it up on the local
 * hardat folders, or on node_modules.
 * @param {string} contractSourcePath contract path to file, e.g.: contracts/modules/SomeModule.sol
 * @returns {string}
 */
function getContractFilePath(contractSourcePath) {
  // First, try to check if its a contract import from the local project
  const localSource = path.resolve(hre.config.paths.root, contractSourcePath);
  if (localSource.startsWith(`${hre.config.paths.sources}${path.sep}`)) {
    if (!fs.existsSync(localSource)) {
      throw new Error(`Contract file for ${localSource} not found.`);
    }

    return localSource;
  }

  // If not, try to resolve the contract path from one of the dependencies
  // or, throw error
  return require.resolve(contractSourcePath);
}

/**
 * Get the list of all modules fully qualified names.
 *   e.g.: ['contracts/modules/SomeModule.sol:SomeModule', ...]
 * @returns {string[]}
 */
async function getModulesFullyQualifiedNames() {
  const names = await hre.artifacts.getAllFullyQualifiedNames();

  const moduleSourcePaths = [];

  for (const name of names) {
    const { sourceName } = parseName(name);
    if (contractIsModule(sourceName)) {
      moduleSourcePaths.push(name);
    }
  }

  return moduleSourcePaths;
}

module.exports = {
  findDuplicateSelectors,
  getAllSelectors,
  getModulesSelectors,
  isAlreadyDeployed,
  contractIsModule,
  getContractFilePath,
  getModulesFullyQualifiedNames,
};
