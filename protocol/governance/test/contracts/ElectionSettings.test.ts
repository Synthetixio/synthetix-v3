import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import { ElectionPeriod } from '../constants';

describe('ElectionSettings', function () {
  const { c, getSigners, getProvider, snapshotCheckpoint } = bootstrap();

  let user: ethers.Signer;

  before('identify signers', function () {
    [, user] = getSigners();
  });

  describe('#setMinEpochDurations', function () {
    it('shows the current schedule', async function () {
      const now = await getTime(getProvider());
      const schedule = await c.CoreProxy.connect(user).getEpochSchedule();
      assertBn.gt(schedule.startDate, 0);
      assertBn.gt(schedule.endDate, now);
      assertBn.gt(schedule.nominationPeriodStartDate, now);
      assertBn.gt(schedule.votingPeriodStartDate, now);
    });
  });

  // setMaxDateAdjustmentTolerance
  // setNextEpochSeatCount
  // setMinimumActiveMembers
});
