import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { integrationBootstrap } from './bootstrap';

describe('cross chain election testing', function () {
  const { chains } = integrationBootstrap();

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

  it('shows that the current period is Administration', async function () {
    const [mothership] = chains;
    assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('interacts with chains', async function () {
    for (const chain of chains) {
      const { chainId } = await chain.provider.getNetwork();
      const proxyAddress = await chain.CoreProxy.address;
      const owner = await chain.CoreProxy.owner();
      console.log({ chainId, proxyAddress, owner });
    }
  });

  it('cast a vote on satellite', async function () {
    const [, satellite] = chains;
    const [, voter] = await _fixtureSignerOnChains();

    const tx = await satellite.CoreProxy.connect(voter).cast(
      [ethers.Wallet.createRandom().address],
      [1000000000]
    );

    const rx = await tx.wait();

    console.log(rx);
  });
});
