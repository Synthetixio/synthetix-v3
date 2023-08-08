import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

describe('SnapshotVotePowerModule', function () {
  const { c, getSigners, getProvider } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  const restore = snapshotCheckpoint(getProvider);

  describe('#setSnapshotContract', function () {
    it('should revert when not owner', async function () {
      await assertRevert(
        c.CoreProxy.connect(user).setSnapshotContract(c.SnapshotRecordMock.address, true),
        `Unauthorized("${await user.getAddress()}"`,
        c.CoreProxy
      );
    });
    it('should set snapshot contract', async function () {
      await c.CoreProxy.setSnapshotContract(c.SnapshotRecordMock.address, true);
      // shouldn't be valid for current epoch
      assert.equal(
        await c.CoreProxy.isSnapshotVotePowerValid(c.SnapshotRecordMock.address, 0),
        false
      );
      // should be valid for next epoch
      assert.equal(
        await c.CoreProxy.isSnapshotVotePowerValid(c.SnapshotRecordMock.address, 1),
        true
      );
    });

    it('should allow for snapshot contracts to be removed on the next epoch', async function () {
      await c.CoreProxy.Council_set_lastElectionId(0);
      await c.CoreProxy.setSnapshotContract(c.SnapshotRecordMock.address, true);
      await c.CoreProxy.Council_newElection();
      await c.CoreProxy.setSnapshotContract(c.SnapshotRecordMock.address, false);
      // should still be valid for this epoch
      assert.equal(
        await c.CoreProxy.isSnapshotVotePowerValid(c.SnapshotRecordMock.address, 1),
        true
      );
      // should not be valid for next epoch
      assert.equal(
        await c.CoreProxy.isSnapshotVotePowerValid(c.SnapshotRecordMock.address, 2),
        false
      );
    });
  });

  describe('#takeVotePowerSnapshot', function () {
    before('set snapshot contract', async function () {
      await c.CoreProxy.setSnapshotContract(c.SnapshotRecordMock.address, true);
      await c.CoreProxy.Council_newElection();
    });

    it('should revert when not correct epoch phase', async function () {
      await assertRevert(
        c.CoreProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address),
        'NotCallableInCurrentPeriod',
        c.CoreProxy
      );
    });

    describe('advance time to nomination phase', function () {
      before('advance time', async function () {
        const settings = await c.CoreProxy.getEpochSchedule();
        await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      });

      it('should take vote power snapshot', async function () {
        // sanity
        assertBn.equal(
          await c.CoreProxy.getVotePowerSnapshotId(
            c.SnapshotRecordMock.address,
            await c.CoreProxy.Council_get_lastElectionId()
          ),
          0
        );
        await c.CoreProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);
        assertBn.gt(
          await c.CoreProxy.getVotePowerSnapshotId(
            c.SnapshotRecordMock.address,
            await c.CoreProxy.Council_get_lastElectionId()
          ),
          0
        );
      });

      it('should fail with snapshot already taken if we repeat', async function () {
        await assertRevert(
          c.CoreProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address),
          'SnapshotAlreadyTaken',
          c.CoreProxy
        );
      });
    });
  });

  describe('#prepareBallotWithSnapshot', function () {
    before(restore);
    before('set snapshot contract', async function () {
      await c.CoreProxy.setSnapshotContract(c.SnapshotRecordMock.address, true);
      await c.CoreProxy.Council_newElection();
      const settings = await c.CoreProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.CoreProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.CoreProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.CoreProxy.Council_get_lastElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);
    });

    it('cannot prepare ballot before voting starts', async function () {
      await assertRevert(
        c.CoreProxy.connect(owner).prepareBallotWithSnapshot(
          c.SnapshotRecordMock.address,
          await user.getAddress()
        ),
        'NotCallableInCurrentPeriod',
        c.CoreProxy
      );
    });

    describe('advance to voting period', function () {
      before('advance time', async function () {
        const settings = await c.CoreProxy.getEpochSchedule();
        await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());
      });

      it('should create an empty ballot with voting power for specified user', async function () {
        const foundVotingPower = await c.CoreProxy.connect(
          owner
        ).callStatic.prepareBallotWithSnapshot(
          c.SnapshotRecordMock.address,
          await user.getAddress()
        );
        await c.CoreProxy.connect(owner).prepareBallotWithSnapshot(
          c.SnapshotRecordMock.address,
          await user.getAddress()
        );

        assertBn.equal(foundVotingPower, 100);

        const ballotVotingPower = await c.CoreProxy.Ballot_get_votingPower(
          await c.CoreProxy.Council_get_lastElectionId(),
          await user.getAddress(),
          13370 // precinct is current chain id
        );

        assertBn.equal(ballotVotingPower, 100);
      });
    });
  });
});
