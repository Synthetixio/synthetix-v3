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
      const { BfpMarketProxy, SettlementHookMock } = systems();

      const maxHooksPerOrder = genNumber(0, 100);
      const whitelistedHookAddresses = [SettlementHookMock.address];

      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
            whitelistedHookAddresses,
            maxHooksPerOrder,
          }),
        provider()
      );

      const ownerAddress = await owner().getAddress();
      await assertEvent(receipt, `SettlementHookConfigured("${ownerAddress}", 1)`, BfpMarketProxy);

      const config = await BfpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(config.whitelistedHookAddresses, whitelistedHookAddresses);
      assertBn.equal(config.maxHooksPerOrder, maxHooksPerOrder);
    });

    it('should override existing config', async () => {
      const { BfpMarketProxy, SettlementHookMock } = systems();

      const configBefore = await BfpMarketProxy.getSettlementHookConfiguration();

      await BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address],
        maxHooksPerOrder: genNumber(100, 500),
      });

      const configAfter = await BfpMarketProxy.getSettlementHookConfiguration();

      assert.notDeepEqual(configBefore, configAfter);
    });

    it('should remove previously whitelisted hook', async () => {
      const { BfpMarketProxy } = systems();

      const configBefore = await BfpMarketProxy.getSettlementHookConfiguration();

      await BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [], // empty hooks
        maxHooksPerOrder: configBefore.maxHooksPerOrder,
      });

      const configAfter = await BfpMarketProxy.getSettlementHookConfiguration();

      assert.deepEqual(configAfter.whitelistedHookAddresses, []); // empty
      assertBn.equal(configBefore.maxHooksPerOrder, configAfter.maxHooksPerOrder); // unchainged
    });

    it('should add new hook and not change previously configured hooks', async () => {
      const { BfpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();

      // Configure to have one hook.
      await BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address],
        maxHooksPerOrder: genNumber(0, 100),
      });

      const configBefore = await BfpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configBefore.whitelistedHookAddresses, [SettlementHookMock.address]);

      // Configure to add another hook.
      await BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
        maxHooksPerOrder: configBefore.maxHooksPerOrder,
      });

      const configAfter = await BfpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configAfter.whitelistedHookAddresses, [
        SettlementHookMock.address,
        SettlementHook2Mock.address,
      ]);
    });

    it('should remove an existing without changing other configured hooks', async () => {
      const { BfpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();

      // Configure to have 2 hooks.
      await BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
        maxHooksPerOrder: genNumber(0, 100),
      });

      const configBefore = await BfpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configBefore.whitelistedHookAddresses, [
        SettlementHookMock.address,
        SettlementHook2Mock.address,
      ]);

      // Remove one of the hooks.
      await BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
        whitelistedHookAddresses: [SettlementHookMock.address],
        maxHooksPerOrder: configBefore.maxHooksPerOrder,
      });

      const configAfter = await BfpMarketProxy.getSettlementHookConfiguration();
      assert.deepEqual(configAfter.whitelistedHookAddresses, [SettlementHookMock.address]);
    });

    it('should revert when settlement hook does not support interface', async () => {
      const { BfpMarketProxy } = systems();

      const invalidHook = genAddress();
      await assertRevert(
        BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
          whitelistedHookAddresses: [invalidHook],
          maxHooksPerOrder: 1,
        }),
        `InvalidHook("${invalidHook}")`,
        BfpMarketProxy
      );
    });

    it('should revert when some hooks do not support interface', async () => {
      const { BfpMarketProxy, SettlementHookMock } = systems();

      const invalidHook = genAddress();
      await assertRevert(
        BfpMarketProxy.connect(owner()).setSettlementHookConfiguration({
          whitelistedHookAddresses: [invalidHook, SettlementHookMock.address],
          maxHooksPerOrder: 1,
        }),
        `InvalidHook("${invalidHook}")`,
        BfpMarketProxy
      );
    });

    it('should revert when non-owner', async () => {
      const { BfpMarketProxy, SettlementHookMock } = systems();

      const maxHooksPerOrder = genNumber(0, 100);
      const whitelistedHookAddresses = [SettlementHookMock.address];

      const from = traders()[0].signer; // not owner.

      await assertRevert(
        BfpMarketProxy.connect(from).setSettlementHookConfiguration({
          whitelistedHookAddresses,
          maxHooksPerOrder,
        }),
        `Unauthorized("${await from.getAddress()}")`,
        BfpMarketProxy
      );
    });
  });
});
