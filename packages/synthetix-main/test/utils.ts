import { ethers } from "ethers";

export function addSnapshotBeforeRestoreAfterEach(provider: () => ethers.providers.JsonRpcProvider) {      
    let snapshotId: any;

    before(async () => {
      snapshotId = await provider().send('evm_snapshot', []);
    });

    afterEach(async () => {
      await provider().send('evm_revert', [snapshotId]);
    });

}