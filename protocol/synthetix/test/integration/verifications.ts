import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

export function verifyUsesFeatureFlag(
  c: () => ethers.Contract,
  flagName: string,
  txn: () => Promise<unknown>
) {
  it(`when ${flagName} feature disabled fails with FeatureUnavailable error`, async () => {
    await c().setFeatureFlagDenyAll(ethers.utils.formatBytes32String(flagName), true);
    await assertRevert(
      txn(),
      `FeatureUnavailable("${ethers.utils.formatBytes32String(flagName)}")`,
      c()
    );
    await c().setFeatureFlagDenyAll(ethers.utils.formatBytes32String(flagName), false);
  });
}
