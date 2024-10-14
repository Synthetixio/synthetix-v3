import { subtask } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import { validateSlotNamespaceCollisions } from '../internal/validate-namespace';
import { SUBTASK_VALIDATE_CONTRACTS } from '../task-names';
import { GetArtifactFunction } from '../types';

type Params = {
  contracts: string[];
  getArtifact: GetArtifactFunction;
};

subtask(SUBTASK_VALIDATE_CONTRACTS).setAction(async ({ contracts, getArtifact }: Params) => {
  const errors = await Promise.all([
    // TODO: find a way to selectively do the mutable state variables check on only necessary contracts
    /*validateMutableStateVariables({
      contracts,
      getArtifact,
    }),*/
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
