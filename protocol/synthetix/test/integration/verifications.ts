import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';
import { bn } from '../common';

export function verifyUsesFeatureFlag(
  c: () => ethers.Contract,
  flagName: string,
  txn: () => Promise<unknown>
) {
  describe(`when ${flagName} feature disabled`, () => {
    it('it fails with feature unavailable', async () => {
      await c().setFeatureFlagDenyAll(ethers.utils.formatBytes32String(flagName), true);
      await assertRevert(
        txn(),
        `FeatureUnavailable("${ethers.utils.formatBytes32String(flagName)}")`,
        c()
      );
      await c().setFeatureFlagDenyAll(ethers.utils.formatBytes32String(flagName), false);
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
        issuanceRatioD18: bn(2),
        liquidationRatioD18: bn(2),
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
