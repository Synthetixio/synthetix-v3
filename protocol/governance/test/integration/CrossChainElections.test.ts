import { ccipReceive } from '@synthetixio/core-modules/test/integration/helpers/ccip';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { integrationBootstrap } from './bootstrap';
import assert from 'assert';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('cross chain election testing', function () {
  const { chains, mothership } = integrationBootstrap();

  let epochStartDate: number;
  let voter0: ethers.Wallet;
  let voter1: ethers.Wallet;
  // let voter2: ethers.Wallet;

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

  before('set up voters', async () => {
    const result = await _fixtureSignerOnChains();
    voter0 = result[0];
    voter1 = result[1];
    // voter2 = result[2];
  });

  it('cast a vote on satellite', async function () {
    const [mothership, satellite1] = chains;
    const randomVoter = ethers.Wallet.createRandom().address;

    const tx = await satellite1.CoreProxy.connect(voter1).cast([randomVoter], [1000000000]);

    const rx = await tx.wait();

    await ccipReceive({
      rx,
      sourceChainSelector: '2664363617261496610',
      targetSigner: voter0,
      ccipAddress: mothership.CcipRouter.address,
    });

    assert.equal(
      await mothership.CoreProxy.hasVoted(
        randomVoter,
        (await satellite1.provider.getNetwork()).chainId
      ),
      false
    );
  });

  it('Sets the election settings', async function () {
    epochStartDate = await getTime(mothership.provider);

    const administrationPeriodDuration = 14;
    const nominationPeriodDuration = 7;
    const votingPeriodDuration = 7;
    const minimumActiveMembers = 1;

    const initialNominationPeriodStartDate =
      epochStartDate + daysToSeconds(administrationPeriodDuration);

    await mothership.CoreProxy.connect(voter0).initOrUpdateElectionSettings(
      [await voter0.getAddress()],
      minimumActiveMembers,
      initialNominationPeriodStartDate,
      administrationPeriodDuration,
      nominationPeriodDuration,
      votingPeriodDuration
    );
  });

  it('shows that the current period is Administration', async function () {
    assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('The current epoch index is correct', async function () {
    assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
  });
});
