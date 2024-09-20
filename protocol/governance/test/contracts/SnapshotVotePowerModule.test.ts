import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import { bootstrap } from './bootstrap';

describe('SnapshotVotePowerModule', function () {
  const { c, getSigners, getProvider } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  const restore = snapshotCheckpoint(getProvider);

  describe('#setSnapshotContract', function () {
    before(restore);

    it('should revert when not owner', async function () {
      await assertRevert(
        c.GovernanceProxy.connect(user).setSnapshotContract(
          c.SnapshotRecordMock.address,
          0,
          ethers.utils.parseEther('1'),
          true
        ),
        `Unauthorized("${await user.getAddress()}"`,
        c.GovernanceProxy
      );
    });

    it('should not be valid until initialized', async function () {
      assert.equal(
        await c.GovernanceProxy.SnapshotVotePower_get_enabled(c.SnapshotRecordMock.address),
        false
      );
    });

    it('should set snapshot contract', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        0,
        ethers.utils.parseEther('1'),
        true
      );
      assert.equal(
        await c.GovernanceProxy.SnapshotVotePower_get_enabled(c.SnapshotRecordMock.address),
        true
      );
    });

    it('should unset snapshot contract', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        0,
        ethers.utils.parseEther('1'),
        false
      );
      assert.equal(
        await c.GovernanceProxy.SnapshotVotePower_get_enabled(c.SnapshotRecordMock.address),
        false
      );
    });
  });

  describe('#takeVotePowerSnapshot', function () {
    before(restore);

    const disabledSnapshotContract = ethers.Wallet.createRandom().address;
    before('setup snapshot contracts', async function () {
      // setup main snapshot contract
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        0,
        ethers.utils.parseEther('1'),
        true
      );

      // setup and disable an snapshot contract
      await c.GovernanceProxy.setSnapshotContract(
        disabledSnapshotContract,
        0,
        ethers.utils.parseEther('1'),
        true
      );
      await c.GovernanceProxy.setSnapshotContract(
        disabledSnapshotContract,
        0,
        ethers.utils.parseEther('1'),
        false
      );
    });

    it('should revert when not correct epoch phase', async function () {
      await assertRevert(
        c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address),
        'NotCallableInCurrentPeriod',
        c.GovernanceProxy
      );
    });

    describe('advance time to nomination phase', function () {
      before('advance time', async function () {
        const settings = await c.GovernanceProxy.getEpochSchedule();
        await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      });

      it('should revert when using invalid snapshot contract', async function () {
        await assertRevert(
          c.GovernanceProxy.takeVotePowerSnapshot(ethers.Wallet.createRandom().address),
          'InvalidSnapshotContract',
          c.GovernanceProxy
        );
      });

      it('should revert when using disabled snapshot contract', async function () {
        await assertRevert(
          c.GovernanceProxy.takeVotePowerSnapshot(disabledSnapshotContract),
          'InvalidSnapshotContract',
          c.GovernanceProxy
        );
      });

      it('should take vote power snapshot', async function () {
        assertBn.equal(
          await c.GovernanceProxy.getVotePowerSnapshotId(
            c.SnapshotRecordMock.address,
            await c.GovernanceProxy.Council_get_currentElectionId()
          ),
          0
        );
        await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);
        assertBn.gt(
          await c.GovernanceProxy.getVotePowerSnapshotId(
            c.SnapshotRecordMock.address,
            await c.GovernanceProxy.Council_get_currentElectionId()
          ),
          0
        );
      });

      it('should fail with snapshot already taken if we repeat', async function () {
        await assertRevert(
          c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address),
          'SnapshotAlreadyTaken',
          c.GovernanceProxy
        );
      });
    });
  });

  describe('#prepareBallotWithSnapshot', function () {
    before(restore);

    const disabledSnapshotContract = ethers.Wallet.createRandom().address;

    before('setup disabled snapshot contract', async function () {
      // setup and disable an snapshot contract
      await c.GovernanceProxy.setSnapshotContract(
        disabledSnapshotContract,
        0,
        ethers.utils.parseEther('1'),
        true
      );
      await c.GovernanceProxy.setSnapshotContract(
        disabledSnapshotContract,
        0,
        ethers.utils.parseEther('1'),
        false
      );
    });

    before('set snapshot contract', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        0,
        ethers.utils.parseEther('1'),
        true
      );
      const settings = await c.GovernanceProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.GovernanceProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.GovernanceProxy.Council_get_currentElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);
    });

    it('cannot prepare ballot before voting starts', async function () {
      await assertRevert(
        c.GovernanceProxy.connect(owner).prepareBallotWithSnapshot(
          c.SnapshotRecordMock.address,
          await user.getAddress()
        ),
        'NotCallableInCurrentPeriod',
        c.GovernanceProxy
      );
    });

    describe('advance to voting period', function () {
      before('advance time', async function () {
        const settings = await c.GovernanceProxy.getEpochSchedule();
        await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());
      });

      it('should revert when using disabled snapshot contract', async function () {
        await assertRevert(
          c.GovernanceProxy.prepareBallotWithSnapshot(
            disabledSnapshotContract,
            await user.getAddress()
          ),
          'InvalidSnapshotContract',
          c.GovernanceProxy
        );
      });

      it('should create an empty ballot with voting power for specified user', async function () {
        const foundVotingPower = await c.GovernanceProxy.connect(
          owner
        ).callStatic.prepareBallotWithSnapshot(
          c.SnapshotRecordMock.address,
          await user.getAddress()
        );
        await c.GovernanceProxy.connect(owner).prepareBallotWithSnapshot(
          c.SnapshotRecordMock.address,
          await user.getAddress()
        );

        assertBn.equal(foundVotingPower, 10);

        const ballotVotingPower = await c.GovernanceProxy.Ballot_get_votingPower(
          await c.GovernanceProxy.Council_get_currentElectionId(),
          await user.getAddress(),
          13370 // precinct is current chain id
        );

        assertBn.equal(ballotVotingPower, 10);
      });
    });
  });
  describe('#getPreparedBallot', function () {
    this.beforeEach(restore);

    it('calculates sqrt', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        0,
        ethers.utils.parseEther('1'),
        true
      );
      const settings = await c.GovernanceProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.GovernanceProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.GovernanceProxy.Council_get_currentElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);

      await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());

      await c.GovernanceProxy.prepareBallotWithSnapshot(
        c.SnapshotRecordMock.address,
        await user.getAddress()
      );

      const votingPower = await c.GovernanceProxy.getPreparedBallot(await user.getAddress());

      assertBn.equal(votingPower, 10);
    });

    it('calculates linear', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        1,
        ethers.utils.parseEther('1'),
        true
      );
      const settings = await c.GovernanceProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.GovernanceProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.GovernanceProxy.Council_get_currentElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);

      await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());

      await c.GovernanceProxy.prepareBallotWithSnapshot(
        c.SnapshotRecordMock.address,
        await user.getAddress()
      );

      const votingPower = await c.GovernanceProxy.getPreparedBallot(await user.getAddress());

      assertBn.equal(votingPower, 100);
    });

    it('calculates with linear weight of 0.5', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        3,
        ethers.utils.parseEther('0.5'),
        true
      );

      const settings = await c.GovernanceProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.GovernanceProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.GovernanceProxy.Council_get_currentElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);

      await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());

      await c.GovernanceProxy.prepareBallotWithSnapshot(
        c.SnapshotRecordMock.address,
        await user.getAddress()
      );

      const votingPower = await c.GovernanceProxy.getPreparedBallot(await user.getAddress());

      assertBn.equal(votingPower, 50);
    });

    it('calculates with linear weight of 2', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        3,
        ethers.utils.parseEther('2'),
        true
      );

      const settings = await c.GovernanceProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.GovernanceProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.GovernanceProxy.Council_get_currentElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);

      await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());

      await c.GovernanceProxy.prepareBallotWithSnapshot(
        c.SnapshotRecordMock.address,
        await user.getAddress()
      );

      const votingPower = await c.GovernanceProxy.getPreparedBallot(await user.getAddress());

      assertBn.equal(votingPower, 200);
    });

    it('calculates with quadratic weight of 0.5', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        2,
        ethers.utils.parseEther('0.5'),
        true
      );

      const settings = await c.GovernanceProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.GovernanceProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.GovernanceProxy.Council_get_currentElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);

      await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());

      await c.GovernanceProxy.prepareBallotWithSnapshot(
        c.SnapshotRecordMock.address,
        await user.getAddress()
      );

      const votingPower = await c.GovernanceProxy.getPreparedBallot(await user.getAddress());

      assertBn.equal(votingPower, 5);
    });

    it('calculates with quadratic weight of 2', async function () {
      await c.GovernanceProxy.setSnapshotContract(
        c.SnapshotRecordMock.address,
        2,
        ethers.utils.parseEther('2'),
        true
      );

      const settings = await c.GovernanceProxy.getEpochSchedule();
      await fastForwardTo(settings.nominationPeriodStartDate.toNumber(), getProvider());
      await c.GovernanceProxy.takeVotePowerSnapshot(c.SnapshotRecordMock.address);

      const snapshotId = await c.GovernanceProxy.getVotePowerSnapshotId(
        c.SnapshotRecordMock.address,
        await c.GovernanceProxy.Council_get_currentElectionId()
      );

      await c.SnapshotRecordMock.setBalanceOfOnPeriod(await user.getAddress(), 100, snapshotId);

      await fastForwardTo(settings.votingPeriodStartDate.toNumber(), getProvider());

      await c.GovernanceProxy.prepareBallotWithSnapshot(
        c.SnapshotRecordMock.address,
        await user.getAddress()
      );

      const votingPower = await c.GovernanceProxy.getPreparedBallot(await user.getAddress());

      assertBn.equal(votingPower, 20);
    });
  });
});
