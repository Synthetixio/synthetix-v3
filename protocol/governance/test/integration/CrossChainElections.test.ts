import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { integrationBootstrap } from './bootstrap';
import { ElectionPeriod } from '../constants';
import { findEvent } from '@synthetixio/core-utils/src/utils/ethers/events';
import assert from 'assert/strict';

describe('cross chain election testing', function () {
  const { chains } = integrationBootstrap();

  // const [mothership] = chains;

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

  // before(async () => {});

  it('shows that the current period is Administration', async function () {
    const [mothership] = chains;
    assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('interacts with chains', async function () {
    for (const chain of chains) {
      // const { chainId } = await chain.provider.getNetwork();
      // const proxyAddress = await chain.CoreProxy.address;
      // const owner = await chain.CoreProxy.owner();
    }
  });

  it.only('cast a vote on satellite', async function () {
    const [, voter] = await _fixtureSignerOnChains();
    const [mothership, satellite1] = chains;
    const tx = await satellite1.CoreProxy.connect(voter).cast(
      [ethers.Wallet.createRandom().address],
      [1000000000]
    );

    const rx = await tx.wait();

    const event = findEvent({
      eventName: 'CCIPSend',
      receipt: rx,
      contract: satellite1.CcipRouter,
    });

    if (!Array.isArray(event)) {
      const msg = event?.args![1].data;
      const [voterAddress, destinationChainId, candidates, amounts] =
        mothership.CoreProxy.interface.parseTransaction({ data: msg }).args;
      // console.log(mothership.CoreProxy.interface.parseTransaction({ data: msg }).args);
      assert.equal(voterAddress, await voter.getAddress());
      await mothership.CoreProxy.connect()._recvCast(
        voterAddress,
        destinationChainId,
        candidates,
        amounts
      );
    }
  });

  it('The current epoch index is correct on all chains', async function () {
    // assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
    // assertBn.equal(await satellite1.CoreProxy.getEpochIndex(), 0);
    // assertBn.equal(await satellite2.CoreProxy.getEpochIndex(), 0);
  });

  it('The current epoch index is correct on all chains', async function () {
    const [mothership, satellite1, satellite2] = chains;

    // assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
    // assertBn.equal(await satellite1.CoreProxy.getEpochIndex(), 0);
    // assertBn.equal(await satellite2.CoreProxy.getEpochIndex(), 0);
  });

  it('shows that the current period is Administration', async function () {
    // assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('shows that the current epoch index is 0', async function () {
    // assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
  });
});
