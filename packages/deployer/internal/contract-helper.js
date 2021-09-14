const { deployedContractHasBytescode } = require('@synthetixio/core-js/utils/contracts');
const { getSelectors } = require('@synthetixio/core-js/utils/contracts');

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

module.exports = {
  isAlreadyDeployed,
  getAllSelectors,
  findDuplicateSelectors,
};
