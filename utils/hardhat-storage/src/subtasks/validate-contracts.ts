import { extendEnvironment, subtask } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { validateSlotNamespaceCollisions } from '../internal/validate-namespace';
import { validateMutableStateVariables } from '../internal/validate-variables';
import { SUBTASK_VALIDATE_CONTRACTS } from '../task-names';
import { GetArtifactFunction } from '../types';

type Params = {
  contracts: string[];
  getArtifact: GetArtifactFunction;
};

declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    runValidateContracts: (params: Params) => Promise<void>;
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  hre.runValidateContracts = async (params: Params): Promise<void> => {
    return hre.run(SUBTASK_VALIDATE_CONTRACTS, params);
  };
});

subtask(SUBTASK_VALIDATE_CONTRACTS).setAction(async ({ contracts, getArtifact }: Params) => {
  const errors = await Promise.all([
    validateMutableStateVariables({
      contracts,
      getArtifact,
    }),
    validateSlotNamespaceCollisions({
      contracts,
      getArtifact,
    }),
  ]).then((result) => result.flat());

  errors.forEach((err) => console.error(err, '\n'));

  if (errors.length) {
    throw new HardhatPluginError('hardhat-storage', 'Storage validation failed');
  }
});
