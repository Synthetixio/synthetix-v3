const path = require('path');
const filterValues = require('filter-values');
const { getSelectors } = require('@synthetixio/core-js/utils/contracts');
const { deployedContractHasBytescode } = require('@synthetixio/core-js/utils/contracts');

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

async function getAllSelectors(contractNames) {
  const allSelectors = [];

  for (const contractName of contractNames) {
    const contractArtifacts = await hre.artifacts.readArtifact(contractName);
    const selectors = await getSelectors(contractArtifacts.abi);

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
  const duplicates = selectors
    .map((s) => s.selector)
    .filter((s, index, selectors) => selectors.indexOf(s) !== index);

  const ocurrences = [];

  if (duplicates.length > 0) {
    duplicates.map((duplicate) => {
      const cases = selectors.filter((s) => s.selector === duplicate);
      ocurrences.push({
        fn: cases[0].name,
        selector: duplicate,
        contracts: cases.map((c) => c.contractName),
      });
    });
  }

  return ocurrences.length > 0 ? ocurrences : null;
}

/**
 * Check if the given contract path is inside the modules folder.
 * @param {string} contractSource contract path to file, e.g.: contracts/modules/SomeModule.sol
 * @returns {boolean}
 */
function contractIsModule(contractSource) {
  const source = path.resolve(hre.config.paths.root, contractSource);
  return source.startsWith(hre.config.deployer.modules);
}

module.exports = {
  findDuplicateSelectors,
  getAllSelectors,
  getModulesSelectors,
  isAlreadyDeployed,
  contractIsModule,
};
