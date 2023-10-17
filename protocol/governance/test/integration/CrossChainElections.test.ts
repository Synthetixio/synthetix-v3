import { ccipReceive } from '@synthetixio/core-modules/test/integration/helpers/ccip';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { integrationBootstrap } from './bootstrap';
import assert from 'assert';

describe('cross chain election testing', function () {
  const { chains, mothership } = integrationBootstrap();

  async function _fixtureSignerOnChains() {
    const { address, privateKey } = ethers.Wallet.createRandom();
    const signers = await Promise.all(
      chains.map(async (chain) => {
        await chain.provider.send('hardhat_setBalance', [address, `0x${(1e22).toString(16)}`]);
        return new ethers.Wallet(privateKey, chain.provider);
      })
    );
    return signers;
  }

  it('cast a vote on satellite', async function () {
    const [targetSigner, voter] = await _fixtureSignerOnChains();
    const [mothership, satellite1] = chains;
    const randomVoter = ethers.Wallet.createRandom().address;

    const tx = await satellite1.CoreProxy.connect(voter).cast([randomVoter], [1000000000]);

    const rx = await tx.wait();

    const tx2 = await ccipReceive({
      rx,
      sourceChainSelector: '2664363617261496610',
      targetSigner,
      ccipAddress: mothership.CcipRouter.address,
    });
    await tx2.wait();
    assert.equal(
      await mothership.CoreProxy.hasVoted(
        randomVoter,
        (await satellite1.provider.getNetwork()).chainId
      ),
      false
    );
  });

  it('shows that the current period is Administration', async function () {
    assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('The current epoch index is correct', async function () {
    assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
  });
});
