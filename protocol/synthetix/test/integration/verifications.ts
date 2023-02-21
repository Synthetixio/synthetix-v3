import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { snapshotCheckpoint } from '../utils/snapshot';

export function verifyUsesFeatureFlag(
  c: () => ethers.Contract,
  flagName: string,
  txn: () => Promise<unknown>
) {
  describe(`when ${flagName} feature disabled`, () => {
    before('disable feature', async () => {
      await c().setFeatureFlagDenyAll(ethers.utils.formatBytes32String(flagName), true);
    });

    after('re-enable feature', async () => {
      await c().setFeatureFlagDenyAll(ethers.utils.formatBytes32String(flagName), false);
    });

    it('it fails with feature unavailable', async () => {
      await assertRevert(
        txn(),
        `FeatureUnavailable("${ethers.utils.formatBytes32String(flagName)}")`,
        c()
      );
    });
  });
}

export function verifyChecksCollateralEnabled(
  c: () => ethers.Contract,
  collateralAddress: () => string,
  txn: () => Promise<unknown>
) {
  describe('collateral is disabled', async () => {
    const restore = snapshotCheckpoint(
      () => c().signer.provider as ethers.providers.JsonRpcProvider
    );
    before('disable collateral', async () => {
      await c().configureCollateral({
        depositingEnabled: false,
        issuanceRatioD18: 0,
        liquidationRatioD18: 0,
        liquidationRewardD18: 0,
        oracleNodeId: ethers.utils.formatBytes32String(''),
        tokenAddress: collateralAddress(),
        minDelegationD18: 0,
      });
    });

    after(restore);

    it('verifies collateral is enabled', async () => {
      await assertRevert(txn(), 'CollateralDepositDisabled', c());
    });
  });
}
