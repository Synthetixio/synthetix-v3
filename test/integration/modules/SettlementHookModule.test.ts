import assert from 'assert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../../bootstrap';
import { genAddress, genBootstrap, genNumber } from '../../generators';
import { withExplicitEvmMine } from '../../helpers';

describe('SettlementHookModule', () => {
  const bs = bootstrap(genBootstrap());
  const { owner, traders, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('setSettlementHookConfiguration', () => {
    it('should configure settlement hooks', async () => {
      const { PerpMarketProxy, SettlementHookMock } = systems();

      const maxHooksPerOrderCommit = genNumber(0, 100);
      const whitelistedHookAddresses = [SettlementHookMock.address];

      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
            whitelistedHookAddresses,
            maxHooksPerOrderCommit,
          }),
        provider()
      );

      const ownerAddress = await owner().getAddress();
      await assertEvent(receipt, `SettlementHookConfigured("${ownerAddress}", 1)`, PerpMarketProxy);

      const config = await PerpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(config.whitelistedHookAddresses, whitelistedHookAddresses);
      assertBn.equal(config.maxHooksPerOrderCommit, maxHooksPerOrderCommit);
    });

    it('should override existing config', async () => {
      const { PerpMarketProxy, SettlementHookMock } = systems();

      const configBefore = await PerpMarketProxy.getSettlementHookConfiguration();

      await PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address],
        maxHooksPerOrderCommit: genNumber(100, 500),
      });

      const configAfter = await PerpMarketProxy.getSettlementHookConfiguration();

      assert.notDeepEqual(configBefore, configAfter);
    });

    it('should remove previously whitelisted hook', async () => {
      const { PerpMarketProxy } = systems();

      const configBefore = await PerpMarketProxy.getSettlementHookConfiguration();

      await PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [], // empty hooks
        maxHooksPerOrderCommit: configBefore.maxHooksPerOrderCommit,
      });

      const configAfter = await PerpMarketProxy.getSettlementHookConfiguration();

      assert.deepEqual(configAfter.whitelistedHookAddresses, []); // empty
      assertBn.equal(configBefore.maxHooksPerOrderCommit, configAfter.maxHooksPerOrderCommit); // unchainged
    });

    it('should add new hook and not change previously configured hooks', async () => {
      const { PerpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();

      // Configure to have one hook.
      await PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address],
        maxHooksPerOrderCommit: genNumber(0, 100),
      });

      const configBefore = await PerpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configBefore.whitelistedHookAddresses, [SettlementHookMock.address]);

      // Configure to add another hook.
      await PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
        maxHooksPerOrderCommit: configBefore.maxHooksPerOrderCommit,
      });

      const configAfter = await PerpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configAfter.whitelistedHookAddresses, [SettlementHookMock.address, SettlementHook2Mock.address]);
    });

    it('should remove an existing without changing other configured hooks', async () => {
      const { PerpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();

      // Configure to have 2 hooks.
      await PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
        maxHooksPerOrderCommit: genNumber(0, 100),
      });

      const configBefore = await PerpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configBefore.whitelistedHookAddresses, [
        SettlementHookMock.address,
        SettlementHook2Mock.address,
      ]);

      // Remove one of the hooks.
      await PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address],
        maxHooksPerOrderCommit: configBefore.maxHooksPerOrderCommit,
      });

      const configAfter = await PerpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configAfter.whitelistedHookAddresses, [SettlementHookMock.address]);
    });

    it('should revert when settlment hook does not support interface', async () => {
      const { PerpMarketProxy } = systems();

      const invalidHook = genAddress();
      await assertRevert(
        PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
          whitelistedHookAddresses: [invalidHook],
          maxHooksPerOrderCommit: 1,
        }),
        `InvalidHook("${invalidHook}")`,
        PerpMarketProxy
      );
    });

    it('should revert when some hooks do not support interface', async () => {
      const { PerpMarketProxy, SettlementHookMock } = systems();

      const invalidHook = genAddress();
      await assertRevert(
        PerpMarketProxy.connect(owner()).setSettlementHookConfiguration({
          whitelistedHookAddresses: [invalidHook, SettlementHookMock.address],
          maxHooksPerOrderCommit: 1,
        }),
        `InvalidHook("${invalidHook}")`,
        PerpMarketProxy
      );
    });

    it('should revert when non-owner', async () => {
      const { PerpMarketProxy, SettlementHookMock } = systems();

      const maxHooksPerOrderCommit = genNumber(0, 100);
      const whitelistedHookAddresses = [SettlementHookMock.address];

      const from = traders()[0].signer; // not owner.

      await assertRevert(
        PerpMarketProxy.connect(from).setSettlementHookConfiguration({
          whitelistedHookAddresses,
          maxHooksPerOrderCommit,
        }),
        `Unauthorized("${await from.getAddress()}")`,
        PerpMarketProxy
      );
    });
  });
});
