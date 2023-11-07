import { ccipReceive } from '@synthetixio/core-modules/test/helpers/ccip';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assert from 'assert';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { ChainSelector, integrationBootstrap, SignerOnChains } from './bootstrap';

describe('cross chain election testing', () => {
  const { chains, fixtureSignerOnChains } = integrationBootstrap();

  const fastForwardToNominationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.nominationPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToVotingPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.votingPeriodStartDate.toNumber() + 10, provider);
  };

  let voter: SignerOnChains;

  before('set up voters', async () => {
    voter = await fixtureSignerOnChains();
  });

  describe('on initialization', function () {
    it('shows that the current period is Administration', async function () {
      assertBn.equal(
        await chains.mothership.CoreProxy.getCurrentPeriod(),
        ElectionPeriod.Administration
      );
    });

    it('the current epoch index is correct', async function () {
      assertBn.equal(await chains.mothership.CoreProxy.getEpochIndex(), 0);
    });
  });

  describe('expected reverts', () => {
    it('cast will fail if not in voting period', async () => {
      const randomCandidate = ethers.Wallet.createRandom().address;

      await assertRevert(
        chains.satellite1.CoreProxy.connect(voter.satellite1).cast(
          [randomCandidate],
          [1000000000],
          {
            value: ethers.utils.parseUnits('0.05', 'gwei'),
          }
        ),
        'NotCallableInCurrentPeriod'
      );
    });
  });

  describe('successful voting', () => {
    it('cast a vote on satellites', async function () {
      const { mothership, satellite1, satellite2 } = chains;
      await satellite1.CoreProxy.setSnapshotContract(satellite1.SnapshotRecordMock.address, true);
      await satellite2.CoreProxy.setSnapshotContract(satellite2.SnapshotRecordMock.address, true);

      await fastForwardToNominationPeriod(mothership.provider);
      await mothership.CoreProxy.connect(voter.mothership).nominate();

      await fastForwardToVotingPeriod(mothership.provider);
      await fastForwardToVotingPeriod(satellite1.provider);
      await fastForwardToVotingPeriod(satellite2.provider);

      //prepare voting for satellite1
      const snapshotId1 = await satellite1.CoreProxy.callStatic.takeVotePowerSnapshot(
        satellite1.SnapshotRecordMock.address
      );
      await satellite1.CoreProxy.takeVotePowerSnapshot(satellite1.SnapshotRecordMock.address);
      await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
        await voter.satellite1.getAddress(),
        ethers.utils.parseEther('100'),
        snapshotId1.add(1).toString()
      );
      await satellite1.CoreProxy.prepareBallotWithSnapshot(
        satellite1.SnapshotRecordMock.address,
        await voter.satellite1.getAddress()
      );

      //prepare voting for satellite2
      const snapshotId2 = await satellite2.CoreProxy.callStatic.takeVotePowerSnapshot(
        satellite2.SnapshotRecordMock.address
      );
      await satellite2.CoreProxy.takeVotePowerSnapshot(satellite2.SnapshotRecordMock.address);
      await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
        await voter.satellite2.getAddress(),
        ethers.utils.parseEther('100'),
        snapshotId2.add(1).toString()
      );
      await satellite2.CoreProxy.prepareBallotWithSnapshot(
        satellite2.SnapshotRecordMock.address,
        await voter.satellite2.getAddress()
      );

      //vote on satellite1
      const tx1 = await satellite1.CoreProxy.connect(voter.satellite1).cast(
        [await voter.mothership.getAddress()],
        [ethers.utils.parseEther('100')]
      );
      const rx1 = await tx1.wait();
      await ccipReceive({
        rx: rx1,
        sourceChainSelector: ChainSelector.OptimisticGoerli,
        targetSigner: voter.mothership,
        ccipAddress: mothership.CcipRouter.address,
      });

      //vote on satellite2
      const tx2 = await satellite1.CoreProxy.connect(voter.satellite2).cast(
        [await voter.mothership.getAddress()],
        [ethers.utils.parseEther('100')]
      );
      const rx2 = await tx2.wait();
      await ccipReceive({
        rx: rx2,
        sourceChainSelector: ChainSelector.AvalancheFuji,
        targetSigner: voter.mothership,
        ccipAddress: mothership.CcipRouter.address,
      });

      const hasVoted1 = await mothership.CoreProxy.hasVoted(
        await voter.satellite1.getAddress(),
        satellite1.chainId
      );

      assert.equal(hasVoted1, true);

      const hasVoted2 = await mothership.CoreProxy.hasVoted(
        await voter.satellite2.getAddress(),
        satellite2.chainId
      );

      assert.equal(hasVoted2, true);
    });
  });
});
