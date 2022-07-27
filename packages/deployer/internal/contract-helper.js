const path = require('path');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { getSelectors } = require('@synthetixio/core-js/utils/ethers/contracts');
const { deployedContractHasBytescode } = require('@synthetixio/core-js/utils/ethers/contracts');
const { onlyRepeated } = require('@synthetixio/core-js/utils/misc/array-filters');

async function isAlreadyDeployed(contractData) {
  if (!contractData.deployedAddress) {
    return false;
  }

  const contractArtifacts = await hre.artifacts.readArtifact(
    contractData.contractFullyQualifiedName
  );

  return deployedContractHasBytescode(
    contractData.deployedAddress,
    contractArtifacts.deployedBytecode,
    hre.ethers.provider
  );
}

async function getAllSelectors(contractFullyQualifiedNames) {
  const allSelectors = [];

  for (const name of contractFullyQualifiedNames) {
    const { contractName, abi } = await hre.artifacts.readArtifact(name);
    const selectors = await getSelectors(abi, hre.config.deployer.routerFunctionFilter);

    allSelectors.push(...selectors.map((s) => ({ ...s, contractName })));
  }

  return allSelectors.sort((a, b) => {
    return Number.parseInt(a.selector, 16) - Number.parseInt(b.selector, 16);
  });
}

async function getModulesSelectors() {
  const contractNames = Object.entries(hre.deployer.deployment.general.contracts)
    .filter(([, c]) => c.isModule)
    .map(([name]) => name);

  return await getAllSelectors(contractNames);
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
 * Get the list of all modules fully qualified names.
 *   e.g.: ['contracts/modules/SomeModule.sol:SomeModule', ...]
 * @param filters RegExp to match for module inclusion
 * @returns {string[]} fqn of all matching modules
 */
async function getModulesFullyQualifiedNames(filter = /.*/) {
  const names = await hre.artifacts.getAllFullyQualifiedNames();

  return names.filter((name) => {
    const { sourceName } = parseFullyQualifiedName(name);
    return contractIsModule(sourceName) && name.match(filter);
  });
}

module.exports = {
  findDuplicateSelectors,
  getAllSelectors,
  getModulesSelectors,
  isAlreadyDeployed,
  contractIsModule,
  getModulesFullyQualifiedNames,
};
