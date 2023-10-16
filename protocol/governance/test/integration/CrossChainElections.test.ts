import { ethers } from 'ethers';
import { integrationBootstrap } from './bootstrap';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ElectionPeriod } from '../constants';

describe('cross chain election testing', function () {
  const { chains } = integrationBootstrap();

  const [mothership, satellite1, satellite2] = chains;

  async function _fixtureSignerOnChains() {
    const { address } = ethers.Wallet.createRandom();
    const signers = await Promise.all(
      chains.map(async (chain) => {
        await chain.provider.send('hardhat_setBalance', [address, `0x${(1e22).toString(16)}`]);
        return await chain.provider.getSigner(address);
      })
    );
    return signers;
  }

  it('interacts with chains', async function () {
    for (const chain of chains) {
      const { chainId } = await chain.provider.getNetwork();
      const proxyAddress = await chain.CoreProxy.address;
      const owner = await chain.CoreProxy.owner();
      console.log({ chainId, proxyAddress, owner });
    }
  });

  it('cast a vote on satellite', async function () {
    const [, voter] = await _fixtureSignerOnChains();

    const tx = await satellite1.CoreProxy.connect(voter).cast(
      [ethers.Wallet.createRandom().address],
      [1000000000]
    );

    const rx = await tx.wait();

    console.log(rx);
  });

  it('The current epoch index is correct on all chains', async function () {
    assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
    assertBn.equal(await satellite1.CoreProxy.getEpochIndex(), 0);
    assertBn.equal(await satellite2.CoreProxy.getEpochIndex(), 0);
  });

  it('The current epoch index is correct on all chains', async function () {
    const [mothership, satellite1, satellite2] = chains;

    assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
    assertBn.equal(await satellite1.CoreProxy.getEpochIndex(), 0);
    assertBn.equal(await satellite2.CoreProxy.getEpochIndex(), 0);
  });

  it('initialize', async function () {
    const [mothership] = chains;
    const [caller] = await _fixtureSignerOnChains();
    const epochStartDate = await getTime(mothership.provider);

    const administrationPeriodDuration = 14;
    const nominationPeriodDuration = 7;
    const votingPeriodDuration = 7;
    const minimumActiveMembers = 1;

    const initialNominationPeriodStartDate =
      epochStartDate + daysToSeconds(administrationPeriodDuration);

    const tx = mothership.CoreProxy.connect(caller).initOrUpdateElectionSettings(
      [await caller.getAddress()],
      minimumActiveMembers,
      initialNominationPeriodStartDate,
      administrationPeriodDuration,
      nominationPeriodDuration,
      votingPeriodDuration
    );

    const rx = await tx.wait();

    console.log(rx);
  });

  it('shows that the current period is Administration', async function () {
    assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('shows that the current epoch index is 0', async function () {
    assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
  });
});
