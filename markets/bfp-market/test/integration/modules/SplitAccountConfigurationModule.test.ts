import assert from 'assert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../../bootstrap';
import { genAddress, genBootstrap, genNumber } from '../../generators';
import { ADDRESS0, withExplicitEvmMine } from '../../helpers';

describe('SplitAccountConfigurationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { owner, traders, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('setEndorsedSplitAccounts', () => {
    it('should configure endorsed accounts', async () => {
      const { BfpMarketProxy } = systems();

      const whitelistedHookAddresses = Array.from(Array(genNumber(1, 10))).map(() => genAddress());

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(owner()).setEndorsedSplitAccounts(whitelistedHookAddresses),
        provider()
      );

      const ownerAddress = await owner().getAddress();
      await assertEvent(
        receipt,
        `SplitAccountConfigured("${ownerAddress}", ${whitelistedHookAddresses.length})`,
        BfpMarketProxy
      );

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), whitelistedHookAddresses);
    });

    it('should override existing config', async () => {
      const { BfpMarketProxy } = systems();
      const addressBefore = genAddress();

      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccounts([addressBefore]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), [addressBefore]);

      const addressAfter = genAddress();
      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccounts([addressAfter]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), [addressAfter]);
    });

    it('should remove previously whitelisted addresses when passed empty array', async () => {
      const { BfpMarketProxy } = systems();
      const addressBefore = genAddress();

      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccounts([addressBefore]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), [addressBefore]);

      await BfpMarketProxy.connect(owner()).setEndorsedSplitAccounts([]);

      assert.deepEqual(await BfpMarketProxy.getEndorsedSplitAccounts(), []);
    });

    it('should revert when non-owner', async () => {
      const { BfpMarketProxy } = systems();

      const from = traders()[0].signer; // not owner.

      await assertRevert(
        BfpMarketProxy.connect(from).setEndorsedSplitAccounts([genAddress()]),
        `Unauthorized("${await from.getAddress()}")`,
        BfpMarketProxy
      );
    });

    it('should revert is passed 0x address', async () => {
      const { BfpMarketProxy } = systems();

      await assertRevert(
        BfpMarketProxy.setEndorsedSplitAccounts([ADDRESS0]),
        `ZeroAddress()`,
        BfpMarketProxy
      );
    });
  });
});
