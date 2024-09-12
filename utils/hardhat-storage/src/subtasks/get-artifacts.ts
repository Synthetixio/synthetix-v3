import { filterContracts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import { subtask } from 'hardhat/config';
import { readHardhatArtifact } from '../internal/read-hardhat-artifact';
import { SUBTASK_GET_ARTIFACTS } from '../task-names';
import { GetArtifactFunction } from '../types';

type Result = {
  contracts: string[];
  getArtifact: GetArtifactFunction;
};

subtask(SUBTASK_GET_ARTIFACTS).setAction(async (_, hre) => {
  const allFqNames = await hre.artifacts.getAllFullyQualifiedNames();
  const contracts = filterContracts(allFqNames, hre.config.storage.artifacts);
  const getArtifact = (fqName: string) => readHardhatArtifact(hre, fqName);
  return { contracts, getArtifact } satisfies Result;
});
