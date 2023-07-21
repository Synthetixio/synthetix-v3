import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
// import { ElectionPeriod } from '../../constants';
// import { BaseElectionModule } from '../../generated/typechain';
import { bootstrap } from '../bootstrap';

describe('ElectionSchedule', function () {
  const { c, getSigners, getProvider, snapshotCheckpoint } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  describe('#getEpochSchedule', function () {
    it('shows the current schedule', async function () {
      const now = await getTime(getProvider());
      const schedule = await c.CoreProxy.connect(user).getEpochSchedule();
      assertBn.gt(schedule.startDate, 0);
      assertBn.gt(schedule.endDate, now);
      assertBn.gt(schedule.nominationPeriodStartDate, now);
      assertBn.gt(schedule.votingPeriodStartDate, now);
    });
  });

  describe('#tweakEpochSchedule', function () {
    snapshotCheckpoint();

    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(c.CoreProxy.connect(user).tweakEpochSchedule(0, 0, 0), 'Unauthorized');
      });
    });
  });

  // tweakEpochSchedule
  // modifyEpochSchedule
  // setMinEpochDurations
  // setMaxDateAdjustmentTolerance
});
