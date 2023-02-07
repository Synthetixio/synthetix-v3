import hre from 'hardhat';
import { ethers } from 'ethers';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { bootstrap } from '../bootstrap';
import { CouncilTokenModule } from '../../../typechain-types';

describe('ElectionModule (initialization)', () => {
  const { systems, provider, signers } = bootstrap();

  let owner: ethers.Signer, user: ethers.Signer;
  let CouncilToken: CouncilTokenModule;

  before('identify signers', async () => {
    [owner, user] = signers();
  });

  before('identify the council token', async function () {
    CouncilToken = await hre.ethers.getContractAt(
      'CouncilTokenModule',
      await systems().Council.getCouncilToken()
    );
  });

  // Note: The module is initialized in the cannonfile.
  describe('when the election module has been initialized', function () {
    it('shows that the module is initialized', async function () {
      assert.equal(await systems().Council.isElectionModuleInitialized(), true);
    });

    it('sets minimum active members', async function () {
      assertBn.equal(await systems().Council.getMinimumActiveMembers(), 1);
    });

    it('sets dates', async function () {
      const now = await getTime(provider());
      const epochDuration = 4 * 30 * 86400; // 4 months
      const nominationPeriodDuration = 7 * 86400; // 7 days
      const votingPeriodDuration = 14 * 86400; // 14 days

      // Note: dates are set in the cannonfile.
      assertBn.equal(await systems().Council.getEpochEndDate(), now + epochDuration);
      assertBn.equal(
        await systems().Council.getVotingPeriodStartDate(),
        now + epochDuration - votingPeriodDuration
      );
      assertBn.equal(
        await systems().Council.getNominationPeriodStartDate(),
        now + epochDuration - votingPeriodDuration - nominationPeriodDuration
      );
    });

    it('sets the first council', async function () {
      assert.deepEqual(await systems().Council.getCouncilMembers(), [await owner.getAddress()]);
    });

    it('sets the debt share contract', async function () {
      assert.equal(await systems().Council.getDebtShareContract(), systems().DebtShare.address);
    });

    it('shows that the council token is properly set', async function () {
      assert.notEqual(
        await systems().Council.getCouncilToken(),
        '0x0000000000000000000000000000000000000000'
      );
    });

    it('shows the expected NFT owners', async function () {
      assertBn.equal(await CouncilToken.balanceOf(await owner.getAddress()), 1);
      assertBn.equal(await CouncilToken.balanceOf(await user.getAddress()), 0);
    });
  });
});
