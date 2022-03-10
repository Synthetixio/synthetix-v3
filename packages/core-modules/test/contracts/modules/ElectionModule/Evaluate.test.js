const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const { ElectionPeriod } = require('./helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('ElectionModule (evaluate)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let epochIndexBefore;

  let candidate1, candidate2, candidate3, candidate4, candidate5;
  let voter1, voter2, voter3, voter4, voter5, voter6, voter7, voter8, voter9, voter10;

  let ballot1, ballot2, ballot3;

  let receipt;

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
        'Spartan Council Token',
        'SCT',
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
        assertBn.equal((await ElectionModule.getNominees()).length, 5);
      });

      describe('when entering the election period', function () {
        before('fast forward', async function () {
          await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
        });

        before('form ballots', async function () {
          ballot1 = {
            candidates: [candidate2.address, candidate1.address],
            id: await ElectionModule.calculateBallotId([candidate2.address, candidate1.address]),
          };
          ballot2 = {
            candidates: [candidate3.address],
            id: await ElectionModule.calculateBallotId([candidate3.address]),
          };
          ballot3 = {
            candidates: [candidate5.address],
            id: await ElectionModule.calculateBallotId([candidate5.address]),
          };
        });

        before('vote', async function () {
          await ElectionModule.connect(voter1).cast(ballot1.candidates);
          await ElectionModule.connect(voter2).cast(ballot1.candidates);
          await ElectionModule.connect(voter3).cast(ballot1.candidates);
          await ElectionModule.connect(voter4).cast(ballot1.candidates);
          await ElectionModule.connect(voter5).cast(ballot2.candidates);
          await ElectionModule.connect(voter6).cast(ballot3.candidates);
          await ElectionModule.connect(voter7).cast(ballot3.candidates);
          await ElectionModule.connect(voter8).cast(ballot3.candidates);
          await ElectionModule.connect(voter9).cast(ballot3.candidates);
          await ElectionModule.connect(voter10).cast(ballot3.candidates);
        });

        it('shows that ballots were registered', async function () {
          assertBn.equal(await ElectionModule.getBallotVotes(ballot1.id), 4);
          assertBn.equal(await ElectionModule.getBallotVotes(ballot2.id), 1);
          assertBn.equal(await ElectionModule.getBallotVotes(ballot3.id), 5);
        });

        describe('when entering the evaluation period', function () {
          before('fast forward', async function () {
            await fastForwardTo(await ElectionModule.getEpochEndDate(), ethers.provider);
          });

          it('shows that the current period is Evaluation', async function () {
            assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Evaluation);
          });

          describe('before evaluating the epoch', function () {
            describe('when trying to resolve the epoch', function () {
              it('reverts', async function () {
                await assertRevert(ElectionModule.resolve(), 'ElectionNotEvaluated');
              });
            });
          });

          describe('when evaluating the epoch', function () {
            describe('partially', function () {
              before('evaluate', async function () {
                const tx = await ElectionModule.evaluate(1);
                receipt = await tx.wait();
              });

              it('emitted an ElectionBatchEvaluated event', async function () {
                const event = findEvent({ receipt, eventName: 'ElectionBatchEvaluated' });

                assert.ok(event);
                assertBn.equal(event.args.epochIndex, 1);
                assertBn.equal(event.args.evaluatedBallots, 1);
                assertBn.equal(event.args.totalBallots, 3);
              });

              it('shows that the epoch is not evaluated', async function () {
                assert.equal(await ElectionModule.isElectionEvaluated(), false);
              });

              it('shows that some candidate votes where processed', async function () {
                assertBn.equal(await ElectionModule.getCandidateVotes(candidate1.address), 4);
                assertBn.equal(await ElectionModule.getCandidateVotes(candidate2.address), 4);
                assertBn.equal(await ElectionModule.getCandidateVotes(candidate3.address), 0);
                assertBn.equal(await ElectionModule.getCandidateVotes(candidate4.address), 0);
                assertBn.equal(await ElectionModule.getCandidateVotes(candidate5.address), 0);
              });

              describe('totally', function () {
                before('evaluate', async function () {
                  const tx = await ElectionModule.evaluate(0);
                  receipt = await tx.wait();
                });

                it('emitted an ElectionEvaluated event', async function () {
                  const event = findEvent({ receipt, eventName: 'ElectionEvaluated' });

                  assert.ok(event);
                  assertBn.equal(event.args.epochIndex, 1);
                  assertBn.equal(event.args.totalBallots, 3);
                });

                it('shows that the epoch is evaluated', async function () {
                  assert.ok(await ElectionModule.isElectionEvaluated());
                });

                it('shows that candidate votes where processed', async function () {
                  assertBn.equal(await ElectionModule.getCandidateVotes(candidate1.address), 4);
                  assertBn.equal(await ElectionModule.getCandidateVotes(candidate2.address), 4);
                  assertBn.equal(await ElectionModule.getCandidateVotes(candidate3.address), 1);
                  assertBn.equal(await ElectionModule.getCandidateVotes(candidate4.address), 0);
                  assertBn.equal(await ElectionModule.getCandidateVotes(candidate5.address), 5);
                });

                it('shows the election winners', async function () {
                  const winners = await ElectionModule.getElectionWinners();

                  assert.equal(winners.length, 3);

                  assert.equal(winners.includes(candidate1.address), true);
                  assert.equal(winners.includes(candidate2.address), true);
                  assert.equal(winners.includes(candidate5.address), true);
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

                      assertBn.equal(epochIndexAfter, epochIndexBefore.add(1));
                    });

                    it('shows that the current period is Idle', async function () {
                      assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Idle);
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
