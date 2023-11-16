import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { integrationBootstrap } from './bootstrap';
import { ethers } from 'ethers';
import assert from 'node:assert/strict';
import { ccipReceive } from '@synthetixio/core-modules/test/helpers/ccip';

describe('Evaluation', function () {
  const { chains } = integrationBootstrap();

  const fastForwardToEvaluationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.endDate.add(10).toNumber(), provider);
  };
  describe('no nominees', () => {
    it('should jump to nomination period', async () => {
      const { mothership, satellite1, satellite2 } = chains;

      assert.deepEqual(await mothership.CoreProxy.getNominees(), []);
      await fastForwardToEvaluationPeriod(mothership.provider);
      assert.equal((await mothership.CoreProxy.getCurrentPeriod()).toNumber(), 3);

      const rx = await (await mothership.CoreProxy.evaluate(0)).wait();

      await ccipReceive({
        ccipAddress: satellite1.CcipRouter.address,
        rx,
        sourceChainSelector: mothership.chainSlector,
        targetSigner: satellite1.signer,
        index: 0,
      });

      await ccipReceive({
        ccipAddress: satellite2.CcipRouter.address,
        rx,
        sourceChainSelector: mothership.chainSlector,
        targetSigner: satellite2.signer,
        index: 1,
      });

      assert.equal((await mothership.CoreProxy.getCurrentPeriod()).toNumber(), 2);
    });
  });
});
