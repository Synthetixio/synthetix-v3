import { subtask } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { contractIsInSources } from '../internal/contract-helper';
import { SUBTASK_GET_SOURCES_ABIS } from '../task-names';
import type { DeploymentAbis } from '../types';

subtask(
  SUBTASK_GET_SOURCES_ABIS,
  'Get the ABIs from all the contracts on the contracts/ folder'
).setAction(async ({ whitelist = [] }, hre) => {
  const contractFullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();

  const filtered = contractFullyQualifiedNames.filter((fqName) => {
    const { sourceName } = parseFullyQualifiedName(fqName);
    if (!contractIsInSources(sourceName, hre)) return false;
    if (whitelist.length && !whitelist.includes(fqName)) return false;
    return true;
  });

  const result: DeploymentAbis = {};

  await Promise.all(
    filtered.map(async (fqName) => {
      const { abi } = await hre.artifacts.readArtifact(fqName);
      result[fqName] = abi;
    })
  );

  return result;
});
