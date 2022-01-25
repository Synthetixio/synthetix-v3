const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { ElectionPeriod } = require('../../helpers/election-helper');

describe('ElectionModule (resolve)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let epochIndexBefore;

  let candidate1, candidate2, candidate3, candidate4, candidate5;
  let voter1, voter2, voter3, voter4, voter5, voter6, voter7, voter8, voter9, voter10;

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [candidate1, candidate2, candidate3, candidate4, candidate5] = users;
    [, , , , , voter1, voter2, voter3, voter4, voter5, voter6, voter7, voter8, voter9, voter10] =
      users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate
      );
    });

    describe('when entering the nomiantion period', function () {
      before('fast forward', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      before('nominate', async function () {
        await ElectionModule.connect(candidate1).nominate();
        await ElectionModule.connect(candidate2).nominate();
        await ElectionModule.connect(candidate3).nominate();
        await ElectionModule.connect(candidate4).nominate();
        await ElectionModule.connect(candidate5).nominate();
      });

      it('shows that nominations exist', async function () {
        assertBn.eq((await ElectionModule.getNominees()).length, 5);
      });

      describe('when entering the election period', function () {
        before('fast forward', async function () {
          await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
        });

        before('vote', async function () {
          await ElectionModule.connect(voter1).elect([candidate1.address]);
          await ElectionModule.connect(voter10).elect([candidate1.address]);
          await ElectionModule.connect(voter6).elect([candidate2.address]);
          await ElectionModule.connect(voter4).elect([candidate3.address]);
          await ElectionModule.connect(voter9).elect([candidate3.address]);
          await ElectionModule.connect(voter3).elect([candidate5.address]);
          await ElectionModule.connect(voter7).elect([candidate1.address, candidate2.address]);
          await ElectionModule.connect(voter2).elect([candidate1.address, candidate3.address]);
          await ElectionModule.connect(voter5).elect([candidate1.address, candidate3.address]);
          await ElectionModule.connect(voter8).elect([
            candidate1.address,
            candidate2.address,
            candidate5.address,
          ]);
        });

        it('shows that votes were registered', async function () {
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([candidate1.address])
            ),
            2
          );
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([candidate2.address])
            ),
            1
          );
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([candidate3.address])
            ),
            2
          );
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([candidate5.address])
            ),
            1
          );
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([candidate4.address])
            ),
            0
          );
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([candidate1.address, candidate2.address])
            ),
            1
          );
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([candidate1.address, candidate3.address])
            ),
            2
          );
          assertBn.eq(
            await ElectionModule.getBallotVotes(
              await ElectionModule.calculateBallotId([
                candidate1.address,
                candidate2.address,
                candidate5.address,
              ])
            ),
            1
          );
        });

        describe('when entering the evaluation period', function () {
          before('fast forward', async function () {
            await fastForwardTo(await ElectionModule.getEpochEndDate(), ethers.provider);
          });

          it('shows that the current period is Evaluation', async function () {
            assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Evaluation);
          });

          describe('before evaluating the epoch', function () {
            describe('when trying to resolve the epoch', function () {
              it('reverts', async function () {
                await assertRevert(ElectionModule.resolve(), 'EpochNotEvaluated');
              });
            });
          });

          describe('when evaluating the epoch', function () {
            describe('partially', function () {
              before('evaluate', async function () {
                await ElectionModule.evaluate(2);
              });

              it('shows that the epoch is not evaluated', async function () {
                assert.equal(await ElectionModule.isElectionEvaluated(), false);
              });

              it('shows that some votes were registered', async function () {
                assertBn.eq(
                  await ElectionModule.getBallotVotes(
                    await ElectionModule.calculateBallotId([candidate1.address])
                  ),
                  2
                );
                assertBn.eq(
                  await ElectionModule.getBallotVotes(
                    await ElectionModule.calculateBallotId([candidate2.address])
                  ),
                  1
                );
              });

              it('shows that some candidate votes where processed', async function () {
                assertBn.eq(await ElectionModule.getCandidateVotes(candidate1.address), 2);
                assertBn.eq(await ElectionModule.getCandidateVotes(candidate2.address), 1);
              });

              describe('totally', function () {
                before('evaluate', async function () {
                  await ElectionModule.evaluate(0);
                });

                it('shows that the epoch is evaluated', async function () {
                  assert.ok(await ElectionModule.isElectionEvaluated());
                });

                it('shows that candidate votes where processed', async function () {
                  assertBn.eq(await ElectionModule.getCandidateVotes(candidate1.address), 6);
                  assertBn.eq(await ElectionModule.getCandidateVotes(candidate2.address), 3);
                  assertBn.eq(await ElectionModule.getCandidateVotes(candidate3.address), 4);
                  assertBn.eq(await ElectionModule.getCandidateVotes(candidate4.address), 0);
                  assertBn.eq(await ElectionModule.getCandidateVotes(candidate5.address), 2);
                });

                it('shows the election winners', async function () {
                  const winners = await ElectionModule.getElectionWinners();

                  assert.equal(winners.length, 3);

                  assert.equal(winners.includes(candidate1.address), true);
                  assert.equal(winners.includes(candidate2.address), true);
                  assert.equal(winners.includes(candidate3.address), true);
                });

                describe('when attempting to evaluate the epoch again', () => {
                  it('reverts', async () => {
                    await assertRevert(ElectionModule.evaluate(0), 'AlreadyEvaluated');
                  });
                });

                describe('when resolving the epoch', function () {
                  before('record the epoch index', async function () {
                    epochIndexBefore = await ElectionModule.getEpochIndex();
                  });

                  before('resolve', async function () {
                    await ElectionModule.resolve();
                  });

                  describe('when a new epoch starts', function () {
                    it('shows that the epoch index increased', async function () {
                      const epochIndexAfter = await ElectionModule.getEpochIndex();

                      assertBn.eq(epochIndexAfter, epochIndexBefore.add(1));
                    });

                    it('shows that the current period is Idle', async function () {
                      assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Idle);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
