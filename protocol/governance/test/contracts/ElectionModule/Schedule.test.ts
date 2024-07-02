import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';
import { ElectionPeriod } from '../../constants';

describe('ElectionModule - schedule', () => {
  const { c, getSigners, getProvider, snapshotCheckpoint } = bootstrap();

  let user: ethers.Signer;
  let owner: ethers.Signer;
  let rx: ethers.ContractReceipt;
  let newNominationPeriodStartDate: ethers.BigNumberish;
  let newVotingPeriodStartDate: ethers.BigNumberish;
  let newEpochEndDate: ethers.BigNumberish;

  before('identify signers', async () => {
    [owner, user] = getSigners();
  });

  before('register emitters', async function () {
    await c.GovernanceProxy.connect(owner).setRegisteredEmitters(
      [10002],
      [c.GovernanceProxy.address]
    );
  });

  // ----------------------------------
  // Evaluation behaviors
  // ----------------------------------

  const itRejectsAdjustments = () => {
    describe('when trying to call the tweakEpochSchedule function', function () {
      it('reverts', async function () {
        await assertRevert(
          c.GovernanceProxy.tweakEpochSchedule(0, 0, 0),
          'NotCallableInCurrentPeriod'
        );
      });
    });
  };

  const itAcceptsAdjustments = () => {
    describe('when trying to adjust the epoch schedule', function () {
      snapshotCheckpoint();

      before('fast forward', async function () {
        const { nominationPeriodStartDate } = await c.GovernanceProxy.getEpochSchedule();
        await fastForwardTo(Number(nominationPeriodStartDate) - daysToSeconds(1), getProvider());
      });

      describe('with zero dates', function () {
        it('reverts', async function () {
          await assertRevert(
            c.GovernanceProxy.tweakEpochSchedule(0, 0, 0),
            'InvalidEpochConfiguration'
          );
        });
      });

      describe('with minor changes', function () {
        describe('with dates too far from the current dates', function () {
          it('reverts', async function () {
            const { nominationPeriodStartDate, votingPeriodStartDate, endDate } =
              await c.GovernanceProxy.getEpochSchedule();

            await assertRevert(
              c.GovernanceProxy.tweakEpochSchedule(
                nominationPeriodStartDate.add(daysToSeconds(2)),
                votingPeriodStartDate.add(daysToSeconds(2)),
                endDate.add(daysToSeconds(8))
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              c.GovernanceProxy.tweakEpochSchedule(
                nominationPeriodStartDate.sub(daysToSeconds(8)),
                votingPeriodStartDate.add(daysToSeconds(2)),
                endDate.add(daysToSeconds(7))
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              c.GovernanceProxy.tweakEpochSchedule(
                nominationPeriodStartDate.add(daysToSeconds(2)),
                votingPeriodStartDate.sub(daysToSeconds(8)),
                endDate.add(daysToSeconds(7))
              ),
              'InvalidEpochConfiguration'
            );
          });
        });

        describe('with dates close to the current dates', function () {
          describe('which change the current period type', function () {
            it('reverts', async function () {
              const { nominationPeriodStartDate, votingPeriodStartDate, endDate } =
                await c.GovernanceProxy.getEpochSchedule();

              await assertRevert(
                c.GovernanceProxy.tweakEpochSchedule(
                  nominationPeriodStartDate.sub(daysToSeconds(1)),
                  votingPeriodStartDate.add(daysToSeconds(0.5)),
                  endDate.add(daysToSeconds(2))
                ),
                'ChangesCurrentPeriod'
              );
            });
          });

          describe('which dont change the current period type', function () {
            before('adjust', async function () {
              const { nominationPeriodStartDate, votingPeriodStartDate, endDate } =
                await c.GovernanceProxy.getEpochSchedule();

              newNominationPeriodStartDate = nominationPeriodStartDate.sub(daysToSeconds(0.5));
              newVotingPeriodStartDate = votingPeriodStartDate.add(daysToSeconds(0.5));
              newEpochEndDate = endDate.add(daysToSeconds(2));

              const tx = await c.GovernanceProxy.tweakEpochSchedule(
                newNominationPeriodStartDate,
                newVotingPeriodStartDate,
                newEpochEndDate
              );
              rx = await tx.wait();
            });

            it('emitted an EpochScheduleUpdated event', async function () {
              await assertEvent(
                rx,
                `EpochScheduleUpdated(${newNominationPeriodStartDate}, ${newVotingPeriodStartDate}, ${newEpochEndDate})`,
                c.GovernanceProxy
              );
            });

            it('properly adjusted dates', async function () {
              const schedule = await c.GovernanceProxy.getEpochSchedule();
              assertBn.near(schedule.nominationPeriodStartDate, newNominationPeriodStartDate, 1);
              assertBn.near(schedule.votingPeriodStartDate, newVotingPeriodStartDate, 1);
              assertBn.near(schedule.endDate, newEpochEndDate, 1);
            });
          });
        });
      });
    });
  };

  // ----------------------------------
  // Administration period
  // ----------------------------------

  describe('when the module is initialized', function () {
    it('shows that initial period is Administration', async function () {
      assertBn.equal(await c.GovernanceProxy.getCurrentPeriod(), ElectionPeriod.Administration);
    });

    describe('when an account that does not own the instance attempts to adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(
          c.GovernanceProxy.connect(user).tweakEpochSchedule(0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('while in the Administration period', function () {
      itAcceptsAdjustments();
    });

    // ----------------------------------
    // Nomination period
    // ----------------------------------

    describe('when entering the nomination period', function () {
      before('fast forward', async function () {
        const schedule = await c.GovernanceProxy.getEpochSchedule();
        await fastForwardTo(Number(schedule.nominationPeriodStartDate), getProvider());
      });

      it('skipped to the target time', async function () {
        const schedule = await c.GovernanceProxy.getEpochSchedule();
        assertBn.near(await getTime(getProvider()), schedule.nominationPeriodStartDate, 1);
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.equal(await c.GovernanceProxy.getCurrentPeriod(), ElectionPeriod.Nomination);
      });

      itRejectsAdjustments();
    });

    // ----------------------------------
    // Vote period
    // ----------------------------------

    describe('when entering the voting period', function () {
      before('ensure nominations', async function () {
        await c.GovernanceProxy.connect(user).nominate();
      });

      before('fast forward', async function () {
        const schedule = await c.GovernanceProxy.getEpochSchedule();
        await fastForwardTo(Number(schedule.votingPeriodStartDate), getProvider());
      });

      it('skipped to the target time', async function () {
        const schedule = await c.GovernanceProxy.getEpochSchedule();
        assertBn.near(await getTime(getProvider()), schedule.votingPeriodStartDate, 1);
      });

      it('shows that the current period is Vote', async function () {
        assertBn.equal(await c.GovernanceProxy.getCurrentPeriod(), ElectionPeriod.Vote);
      });

      itRejectsAdjustments();
    });

    // ----------------------------------
    // Evaluation period
    // ----------------------------------

    describe('when entering the evaluation period', function () {
      before('fast forward', async function () {
        const schedule = await c.GovernanceProxy.getEpochSchedule();
        await fastForwardTo(Number(schedule.endDate), getProvider());
      });

      it('skipped to the target time', async function () {
        const schedule = await c.GovernanceProxy.getEpochSchedule();
        assertBn.near(await getTime(getProvider()), schedule.endDate, 1);
      });

      it('shows that the current period is Evaluation', async function () {
        assertBn.equal(await c.GovernanceProxy.getCurrentPeriod(), ElectionPeriod.Evaluation);
      });

      itRejectsAdjustments();
    });
  });
});
