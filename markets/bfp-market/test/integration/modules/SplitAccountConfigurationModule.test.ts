import assert from 'assert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../../bootstrap';
import { genAddress, genBootstrap } from '../../generators';
import { withExplicitEvmMine } from '../../helpers';

describe('SplitAccountConfigurationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { owner, traders, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('setEndorsedSplitAccount', () => {
    it('should configure endorsed accounts', async () => {
      const { BfpMarketProxy } = systems();

      const whitelistedHookAddresses = [genAddress(), genAddress()];

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(owner()).setEndorsedSplitAccount(whitelistedHookAddresses),
        provider()
      );

      const ownerAddress = await owner().getAddress();
      await assertEvent(receipt, `SplitAccountConfigured("${ownerAddress}", 2)`, BfpMarketProxy);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), whitelistedHookAddresses);
    });

    it('should override existing config', async () => {
      const { BfpMarketProxy } = systems();
      const addressBefore = genAddress();

      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccount([addressBefore]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), [addressBefore]);

      const addressAfter = genAddress();
      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccount([addressAfter]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), [addressAfter]);
    });

    it('should remove previously whitelisted addresses when passed empty array', async () => {
      const { BfpMarketProxy } = systems();
      const addressBefore = genAddress();

      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccount([addressBefore]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), [addressBefore]);

      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccount([]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), []);
    });

    it('should revert when non-owner', async () => {
      const { BfpMarketProxy } = systems();

      const from = traders()[0].signer; // not owner.

      await assertRevert(
        BfpMarketProxy.connect(from).setEndorsedSplitAccount([genAddress()]),
        `Unauthorized("${await from.getAddress()}")`,
        BfpMarketProxy
      );
    });
  });
});
