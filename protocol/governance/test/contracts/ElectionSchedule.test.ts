import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { bootstrap } from './bootstrap';

interface ScheduleConfig {
  nominationPeriodStartDate: ethers.BigNumber;
  votingPeriodStartDate: ethers.BigNumber;
  endDate: ethers.BigNumber;
}

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
      const schedule = await c.GovernanceProxy.connect(user).getEpochSchedule();
      assertBn.gt(schedule.startDate, 0);
      assertBn.gt(schedule.endDate, now);
      assertBn.gt(schedule.nominationPeriodStartDate, now);
      assertBn.gt(schedule.votingPeriodStartDate, now);
    });
  });

  describe('#tweakEpochSchedule', function () {
    snapshotCheckpoint();

    async function _tweakEpochSchedule({
      nominationPeriodStartDate,
      votingPeriodStartDate,
      endDate,
    }: Partial<ScheduleConfig> = {}) {
      const schedule = await c.GovernanceProxy.getEpochSchedule();
      const tx = await c.GovernanceProxy.tweakEpochSchedule(
        nominationPeriodStartDate || schedule.nominationPeriodStartDate,
        votingPeriodStartDate || schedule.votingPeriodStartDate,
        endDate || schedule.endDate
      );
      await tx.wait();
      return tx;
    }

    it('shows that the current period is Administration', async function () {
      assertBn.equal(await c.GovernanceProxy.getCurrentPeriod(), ElectionPeriod.Administration);
    });

    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(
          c.GovernanceProxy.connect(user).tweakEpochSchedule(0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('when trying to modify outside of "maxDateAdjustmentTolerance" settings', function () {
      let tolerance: ethers.BigNumber;
      let schedule: ScheduleConfig;

      before('load current configuration', async function () {
        const settings = await c.GovernanceProxy.getElectionSettings();
        tolerance = settings.maxDateAdjustmentTolerance;
        schedule = await c.GovernanceProxy.getEpochSchedule();
      });

      const dateNames = ['nominationPeriodStartDate', 'votingPeriodStartDate', 'endDate'] as const;

      for (const dateName of dateNames) {
        it(`reverts when new "${dateName}" is less than "maxDateAdjustmentTolerance"`, async function () {
          await assertRevert(
            _tweakEpochSchedule({
              [dateName]: schedule[dateName].sub(tolerance).sub(1),
            }),
            'InvalidEpochConfiguration'
          );
        });

        it(`reverts when new "${dateName}" is over "maxDateAdjustmentTolerance"`, async function () {
          await assertRevert(
            _tweakEpochSchedule({
              [dateName]: schedule[dateName].add(tolerance).add(1),
            }),
            'InvalidEpochConfiguration'
          );
        });
      }
    });

    describe('when trying to bypass "maxDateAdjustmentTolerance" by calling it several times', function () {
      describe('when tweaking "epochEndDate"', function () {
        snapshotCheckpoint();

        it('reverts', async function () {
          const schedule = await c.GovernanceProxy.getEpochSchedule();
          const settings = await c.GovernanceProxy.getElectionSettings();
          const tolerance = settings.maxDateAdjustmentTolerance;

          // Bring the date to the limit
          await _tweakEpochSchedule({
            endDate: schedule.endDate.add(tolerance),
          });

          await assertRevert(
            _tweakEpochSchedule({
              endDate: schedule.endDate.add(tolerance).add(tolerance),
            }),
            'InvalidEpochConfiguration'
          );
        });
      });
    });

    describe('when a tweak modifies the current period', function () {
      let schedule: ScheduleConfig;

      snapshotCheckpoint();

      before('load current configuration', async function () {
        schedule = await c.GovernanceProxy.getEpochSchedule();
      });

      before('fast forward', async function () {
        await fastForwardTo(
          schedule.nominationPeriodStartDate.sub(daysToSeconds(1)).toNumber(),
          getProvider()
        );
      });

      it('reverts', async function () {
        const nominationPeriodStartDate = schedule.nominationPeriodStartDate.sub(daysToSeconds(2));
        await assertRevert(
          _tweakEpochSchedule({ nominationPeriodStartDate }),
          'ChangesCurrentPeriod'
        );
      });
    });

    describe('when correctly tweaking inside "maxDateAdjustmentTolerance"', function () {
      snapshotCheckpoint();

      it('correctly tweaks to new schedule', async function () {
        const original = await c.GovernanceProxy.getEpochSchedule();

        const newSchedule = {
          nominationPeriodStartDate: original.nominationPeriodStartDate.add(daysToSeconds(2)),
          votingPeriodStartDate: original.votingPeriodStartDate.add(daysToSeconds(2)),
          endDate: original.endDate.add(daysToSeconds(2)),
        };

        await _tweakEpochSchedule(newSchedule);

        const result = await c.GovernanceProxy.getEpochSchedule();
        assertBn.equal(result.nominationPeriodStartDate, newSchedule.nominationPeriodStartDate);
        assertBn.equal(result.votingPeriodStartDate, newSchedule.votingPeriodStartDate);
        assertBn.equal(result.endDate, newSchedule.endDate);
      });
    });

    describe.skip('when calling it outside of Administration period', function () {
      let schedule: ScheduleConfig;

      snapshotCheckpoint();

      before('load current configuration', async function () {
        schedule = await c.GovernanceProxy.getEpochSchedule();
      });

      describe('when calling during Nomination period', function () {
        before('fast forward', async function () {
          await fastForwardTo(schedule.nominationPeriodStartDate.toNumber(), getProvider());
        });

        it('reverts', async function () {
          await assertRevert(_tweakEpochSchedule(), 'NotCallableInCurrentPeriod');
        });

        describe('when calling during Vote period', function () {
          before('fast forward', async function () {
            await fastForwardTo(schedule.votingPeriodStartDate.toNumber(), getProvider());
          });

          it('reverts', async function () {
            await assertRevert(_tweakEpochSchedule(), 'NotCallableInCurrentPeriod');
          });

          describe('when calling during Evaluation period', function () {
            before('fast forward', async function () {
              await fastForwardTo(schedule.endDate.toNumber(), getProvider());
            });

            it('reverts', async function () {
              await assertRevert(_tweakEpochSchedule(), 'NotCallableInCurrentPeriod');
            });
          });
        });
      });
    });
  });
});
