const { subtask } = require('hardhat/config');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { contractIsInSources } = require('../internal/contract-helper');
const { SUBTASK_GET_SOURCES_ABIS } = require('../task-names');

subtask(
  SUBTASK_GET_SOURCES_ABIS,
  'Get the ABIs from all the contracts on the contracts/ folder'
).setAction(async ({ whitelist = [] }, hre) => {
  const contractFullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();

  const filtered = contractFullyQualifiedNames.filter((fqName) => {
    const { sourceName } = parseFullyQualifiedName(fqName);
    if (!contractIsInSources(sourceName)) return false;
    if (whitelist.length && !whitelist.includes(fqName)) return false;
    return true;
  });

  const result = {};

  await Promise.all(
    filtered.map(async (fqName) => {
      const { abi } = await hre.artifacts.readArtifact(fqName);
      result[fqName] = abi;
    })
  );

  return result;
});
