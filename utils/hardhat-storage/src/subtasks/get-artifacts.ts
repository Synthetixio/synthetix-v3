import { filterContracts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import { extendEnvironment, subtask } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { readHardhatArtifact } from '../internal/read-hardhat-artifact';
import { SUBTASK_GET_ARTIFACTS } from '../task-names';
import { GetArtifactFunction } from '../types';

type Result = {
  contracts: string[];
  getArtifact: GetArtifactFunction;
};

declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    runGetArtifacts: () => Promise<Result>;
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  hre.runGetArtifacts = async (): Promise<Result> => {
    return hre.run(SUBTASK_GET_ARTIFACTS);
  };
});

subtask(SUBTASK_GET_ARTIFACTS).setAction(async (_, hre) => {
  const allFqNames = await hre.artifacts.getAllFullyQualifiedNames();
  const contracts = filterContracts(allFqNames, hre.config.storage.artifacts);
  const getArtifact = (fqName: string) => readHardhatArtifact(hre, fqName);
  return { contracts, getArtifact } satisfies Result;
});
