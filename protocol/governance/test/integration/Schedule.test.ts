import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import {
  fastForwardTo,
  getTime,
  restoreSnapshot,
  takeSnapshot,
} from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import { ElectionPeriod } from '../constants';

describe('ElectionModule - schedule', () => {
  const { c, getSigners, getProvider } = bootstrap();

  let user: ethers.Signer;
  let rx: ethers.ContractReceipt;
  let newNominationPeriodStartDate: number;
  let newVotingPeriodStartDate: number;
  let newEpochEndDate: number;

  before('identify signers', async () => {
    [, user] = getSigners();
  });

  // ----------------------------------
  // Evaluation behaviors
  // ----------------------------------

  const itRejectsAdjustments = () => {
    describe('when trying to call the tweakEpochSchedule function', function () {
      it('reverts', async function () {
        await assertRevert(c.CoreProxy.tweakEpochSchedule(0, 0, 0), 'NotCallableInCurrentPeriod');
      });
    });

    describe('when trying to call the modifyEpochSchedule function', function () {
      it('reverts', async function () {
        await assertRevert(c.CoreProxy.modifyEpochSchedule(0, 0, 0), 'NotCallableInCurrentPeriod');
      });
    });
  };

  const itAcceptsAdjustments = () => {
    describe('when trying to adjust the epoch schedule', function () {
      let snapshotId: string;

      before('fast forward', async function () {
        const nominationPeriod = await c.CoreProxy.getNominationPeriodStartDate();
        await fastForwardTo(Number(nominationPeriod) - daysToSeconds(1), getProvider());
      });

      before('take snapshot', async function () {
        snapshotId = await takeSnapshot(getProvider());
      });

      after('restore snapshot', async function () {
        await restoreSnapshot(snapshotId, getProvider());
      });

      describe('with zero dates', function () {
        it('reverts', async function () {
          await assertRevert(c.CoreProxy.tweakEpochSchedule(0, 0, 0), 'InvalidEpochConfiguration');
        });
      });

      describe('with minor changes', function () {
        describe('with dates too far from the current dates', function () {
          it('reverts', async function () {
            const epochEndDate = (await c.CoreProxy.getEpochEndDate()).toNumber();
            const nominationPeriodStartDate = (
              await c.CoreProxy.getNominationPeriodStartDate()
            ).toNumber();
            const votingPeriodStartDate = (await c.CoreProxy.getVotingPeriodStartDate()).toNumber();

            await assertRevert(
              c.CoreProxy.tweakEpochSchedule(
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate + daysToSeconds(2),
                epochEndDate + daysToSeconds(8)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              c.CoreProxy.tweakEpochSchedule(
                nominationPeriodStartDate - daysToSeconds(8),
                votingPeriodStartDate + daysToSeconds(2),
                epochEndDate + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              c.CoreProxy.tweakEpochSchedule(
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate - daysToSeconds(8),
                epochEndDate + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
          });
        });

        describe('with dates close to the current dates', function () {
          describe('which change the current period type', function () {
            it('reverts', async function () {
              await assertRevert(
                c.CoreProxy.tweakEpochSchedule(
                  (await c.CoreProxy.getNominationPeriodStartDate()).toNumber() - daysToSeconds(2),
                  (await c.CoreProxy.getVotingPeriodStartDate()).toNumber() + daysToSeconds(0.5),
                  (await c.CoreProxy.getEpochEndDate()).toNumber() + daysToSeconds(4)
                ),
                'ChangesCurrentPeriod'
              );
            });
          });

          describe('which dont change the current period type', function () {
            before('adjust', async function () {
              newEpochEndDate = (await c.CoreProxy.getEpochEndDate()).toNumber() + daysToSeconds(4);
              newNominationPeriodStartDate =
                (await c.CoreProxy.getNominationPeriodStartDate()).toNumber() - daysToSeconds(0.5);
              newVotingPeriodStartDate =
                (await c.CoreProxy.getVotingPeriodStartDate()).toNumber() + daysToSeconds(0.5);

              const tx = await c.CoreProxy.tweakEpochSchedule(
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
                c.CoreProxy
              );
            });

            it('properly adjusted dates', async function () {
              assertBn.near(
                await c.CoreProxy.getNominationPeriodStartDate(),
                newNominationPeriodStartDate,
                1
              );
              assertBn.near(
                await c.CoreProxy.getVotingPeriodStartDate(),
                newVotingPeriodStartDate,
                1
              );
              assertBn.near(await c.CoreProxy.getEpochEndDate(), newEpochEndDate, 1);
            });
          });
        });
      });

      describe('with major changes', function () {
        describe('with dates far from the current dates', function () {
          describe('which change the current period type', function () {
            it('reverts', async function () {
              await assertRevert(
                c.CoreProxy.modifyEpochSchedule(
                  (await c.CoreProxy.getNominationPeriodStartDate()).sub(daysToSeconds(2)),
                  (await c.CoreProxy.getVotingPeriodStartDate()).add(daysToSeconds(100)),
                  (await c.CoreProxy.getEpochEndDate()).add(daysToSeconds(100))
                ),
                'ChangesCurrentPeriod'
              );
            });
          });

          describe('which dont change the current period type', function () {
            before('adjust', async function () {
              newEpochEndDate =
                (await c.CoreProxy.getEpochEndDate()).toNumber() + daysToSeconds(100);
              newNominationPeriodStartDate =
                (await c.CoreProxy.getNominationPeriodStartDate()).toNumber() + daysToSeconds(100);
              newVotingPeriodStartDate =
                (await c.CoreProxy.getVotingPeriodStartDate()).toNumber() + daysToSeconds(100);

              const tx = await c.CoreProxy.modifyEpochSchedule(
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
                c.CoreProxy
              );
            });

            it('properly adjusted dates', async function () {
              assertBn.near(
                await c.CoreProxy.getNominationPeriodStartDate(),
                newNominationPeriodStartDate,
                1
              );
              assertBn.near(
                await c.CoreProxy.getVotingPeriodStartDate(),
                newVotingPeriodStartDate,
                1
              );
              assertBn.near(await c.CoreProxy.getEpochEndDate(), newEpochEndDate, 1);
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
      assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
    });

    describe('when an account that does not own the instance attempts to adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(c.CoreProxy.connect(user).tweakEpochSchedule(0, 0, 0), 'Unauthorized');
      });
    });

    describe('when an account that does not own the instance attempts to unsafely adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(c.CoreProxy.connect(user).modifyEpochSchedule(0, 0, 0), 'Unauthorized');
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
        await fastForwardTo(
          Number(await c.CoreProxy.getNominationPeriodStartDate()),
          getProvider()
        );
      });

      it('skipped to the target time', async function () {
        assertBn.near(
          await getTime(getProvider()),
          await c.CoreProxy.getNominationPeriodStartDate(),
          1
        );
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Nomination);
      });

      itRejectsAdjustments();
    });

    // ----------------------------------
    // Vote period
    // ----------------------------------

    describe('when entering the voting period', function () {
      before('ensure nominations', async function () {
        await c.CoreProxy.connect(user).nominate();
      });

      before('fast forward', async function () {
        await fastForwardTo(Number(await c.CoreProxy.getVotingPeriodStartDate()), getProvider());
      });

      it('skipped to the target time', async function () {
        assertBn.near(
          await getTime(getProvider()),
          await c.CoreProxy.getVotingPeriodStartDate(),
          1
        );
      });

      it('shows that the current period is Vote', async function () {
        assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Vote);
      });

      itRejectsAdjustments();
    });

    // ----------------------------------
    // Evaluation period
    // ----------------------------------

    describe('when entering the evaluation period', function () {
      before('fast forward', async function () {
        await fastForwardTo(Number(await c.CoreProxy.getEpochEndDate()), getProvider());
      });

      it('skipped to the target time', async function () {
        assertBn.near(await getTime(getProvider()), await c.CoreProxy.getEpochEndDate(), 1);
      });

      it('shows that the current period is Evaluation', async function () {
        assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Evaluation);
      });

      itRejectsAdjustments();
    });
  });
});
