import { CannonWrapperGenericProvider } from '@usecannon/builder';
import { ethers } from 'ethers';

export function snapshotCheckpoint(
  provider: () => ethers.providers.JsonRpcProvider | CannonWrapperGenericProvider
) {
  let snapshotId: number;

  const snapshot = async () => {
    snapshotId = await provider().send('evm_snapshot', []);
  };

  before('snapshot', async () => {
    await snapshot();
  });

  const restore = async () => {
    await provider().send('evm_revert', [snapshotId]);
    await snapshot();
  };

  return restore;
}
