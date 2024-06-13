import assert from 'node:assert/strict';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { integrationBootstrap, SignerOnChains } from './bootstrap';

describe('Evaluation', function () {
  const { chains } = integrationBootstrap();

  const fastForwardToEvaluationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.GovernanceProxy.getEpochSchedule();
    await fastForwardTo(schedule.endDate.add(10).toNumber(), provider);
  };

  before('register emitters', async function () {
    await chains.mothership.GovernanceProxy.connect(chains.mothership.signer).setRegisteredEmitters(
      [13370],
      [chains.mothership.GovernanceProxy.address]
    );
  });

  describe('no nominees', () => {
    it('should jump to nomination period', async () => {
      const { mothership } = chains;

      assert.deepEqual(await mothership.GovernanceProxy.getNominees(), []);
      await fastForwardToEvaluationPeriod(mothership.provider);
      assert.equal((await mothership.GovernanceProxy.getCurrentPeriod()).toNumber(), 3);

      await mothership.GovernanceProxy.evaluate(0);

      // await ccipReceive({
      //   ccipAddress: satellite1.CcipRouter.address,
      //   rx,
      //   sourceChainSelector: mothership.chainSlector,
      //   targetSigner: satellite1.signer,
      //   index: 0,
      // });

      // await ccipReceive({
      //   ccipAddress: satellite2.CcipRouter.address,
      //   rx,
      //   sourceChainSelector: mothership.chainSlector,
      //   targetSigner: satellite2.signer,
      //   index: 1,
      // });

      assert.equal((await mothership.GovernanceProxy.getCurrentPeriod()).toNumber(), 2);
    });
  });
});
