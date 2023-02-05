import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

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
