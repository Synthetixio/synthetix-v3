import { ccipReceive } from '@synthetixio/core-modules/test/helpers/ccip';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { typedEntries, typedValues } from '../helpers/object';
import { ChainSelector, integrationBootstrap, SignerOnChains } from './bootstrap';

describe('cross chain election testing', function () {
  const { chains, fixtureSignerOnChains, fastForwardChainsTo } = integrationBootstrap();

  const fastForwardToNominationPeriod = async () => {
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
    await fastForwardChainsTo(schedule.nominationPeriodStartDate.toNumber() + 10);
  };

  const fastForwardToVotingPeriod = async () => {
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
    await fastForwardChainsTo(schedule.votingPeriodStartDate.toNumber() + 10);
  };

  let nominee: SignerOnChains;
  let voter: SignerOnChains;

  before('set up users', async function () {
    nominee = await fixtureSignerOnChains();
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

  describe('expected reverts', function () {
    it('cast will fail if not in voting period', async function () {
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

  describe('successful voting on all chains', function () {
    before('prepare snapshot record on all chains', async function () {
      for (const chain of typedValues(chains)) {
        await chain.CoreProxy.connect(chain.signer).setSnapshotContract(
          chain.SnapshotRecordMock.address,
          true
        );
      }
    });

    before('nominate', async function () {
      await fastForwardToNominationPeriod();
      await chains.mothership.CoreProxy.connect(nominee.mothership).nominate();
    });

    before('preapare ballots on all chains', async function () {
      await fastForwardToVotingPeriod();

      for (const [chainName, chain] of typedEntries(chains)) {
        const snapshotId1 = await chain.CoreProxy.callStatic.takeVotePowerSnapshot(
          chain.SnapshotRecordMock.address // TODO: should we remove this param? it is being set on setSnapshotContract
        );
        await chain.CoreProxy.takeVotePowerSnapshot(chain.SnapshotRecordMock.address);
        await chain.SnapshotRecordMock.setBalanceOfOnPeriod(
          await voter[chainName].getAddress(),
          ethers.utils.parseEther('100'),
          snapshotId1.add(1).toString()
        );
        await chain.CoreProxy.prepareBallotWithSnapshot(
          chain.SnapshotRecordMock.address,
          await voter[chainName].getAddress()
        );
      }
    });

    it('casts vote on mothership', async function () {
      const { mothership } = chains;

      const tx = await mothership.CoreProxy.connect(voter.mothership).cast(
        [await nominee.mothership.getAddress()],
        [ethers.utils.parseEther('100')]
      );
      await tx.wait();

      const hasVoted = await mothership.CoreProxy.hasVoted(
        await voter.mothership.getAddress(),
        mothership.chainId
      );

      assert.equal(hasVoted, true);
    });

    it('casts vote on satellite1', async function () {
      const { mothership, satellite1 } = chains;

      const tx = await satellite1.CoreProxy.connect(voter.satellite1).cast(
        [await nominee.mothership.getAddress()],
        [ethers.utils.parseEther('100')]
      );
      const rx = await tx.wait();
      await ccipReceive({
        rx,
        sourceChainSelector: ChainSelector.satellite1,
        targetSigner: voter.mothership,
        ccipAddress: mothership.CcipRouter.address,
      });

      const hasVoted = await mothership.CoreProxy.hasVoted(
        await voter.satellite1.getAddress(),
        satellite1.chainId
      );

      assert.equal(hasVoted, true);
    });

    it('casts vote on satellite2', async function () {
      const { mothership, satellite2 } = chains;

      const tx = await satellite2.CoreProxy.connect(voter.satellite2).cast(
        [await nominee.mothership.getAddress()],
        [ethers.utils.parseEther('100')]
      );
      const rx = await tx.wait();
      await ccipReceive({
        rx,
        sourceChainSelector: ChainSelector.satellite2,
        targetSigner: voter.mothership,
        ccipAddress: mothership.CcipRouter.address,
      });

      const hasVoted = await mothership.CoreProxy.hasVoted(
        await voter.satellite2.getAddress(),
        satellite2.chainId
      );

      assert.equal(hasVoted, true);
    });
  });
});
