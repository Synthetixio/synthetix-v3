const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { getUnixTimestamp, daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { ElectionPeriod } = require('../../helpers/election-helper');

describe('ElectionModule (vote)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let candidate1, candidate2, candidate3;
  let voter1, voter2, voter3, voter4, voter5;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate;

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [candidate1, candidate2, candidate3] = users;
    [, , , voter1, voter2, voter3, voter4, voter5] = users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = getUnixTimestamp();

      epochEndDate = now + daysToSeconds(90);
      votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        epochEndDate,
        nominationPeriodStartDate,
        votingPeriodStartDate
      );
    });

    describe('when entering the nomiantion period', function () {
      before('fast forward', async function () {
        await fastForwardTo(nominationPeriodStartDate, ethers.provider);
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Nomination);
      });

      describe('when nominations exist', function () {
        before('nominate', async function () {
          await ElectionModule.connect(candidate1).nominate();
          await ElectionModule.connect(candidate2).nominate();
          await ElectionModule.connect(candidate3).nominate();
        });

        describe('when entering the vote period', function () {
          before('fast forward', async function () {
            await fastForwardTo(votingPeriodStartDate, ethers.provider);
          });

          it('shows that the current period is Vote', async function () {
            assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Vote);
          });

          describe('when issuing invalid votes', function () {
            describe('when voting with zero candidates', function () {
              it('reverts', async function () {
                await assertRevert(ElectionModule.elect([]), 'NoCandidates');
              });
            });

            describe('when voting candidates that are not nominated', function () {
              it('reverts', async function () {
                await assertRevert(
                  ElectionModule.elect([candidate1.address, candidate2.address, voter1.address]),
                  'NotNominated'
                );
              });
            });

            describe('when voting duplicate candidates', function () {
              it('reverts', async function () {
                await assertRevert(
                  ElectionModule.elect([
                    candidate1.address,
                    candidate2.address,
                    candidate1.address,
                  ]),
                  'DuplicateCandidates'
                );
              });
            });
          });

          it('can retrieve user vote power', async function () {
            assertBn.eq(await ElectionModule.getVotePower(voter1.address), 1);
            assertBn.eq(await ElectionModule.getVotePower(voter2.address), 1);
            assertBn.eq(await ElectionModule.getVotePower(voter3.address), 1);
          });

          describe('when issuing valid votes', function () {
            let ballot1, ballot2, ballot3;

            before('form ballots', async function () {
              ballot1 = {
                candidates: [candidate1.address],
                id: await ElectionModule.calculateBallotId([candidate1.address]),
              };
              ballot2 = {
                candidates: [candidate2.address],
                id: await ElectionModule.calculateBallotId([candidate2.address]),
              };
              ballot3 = {
                candidates: [candidate2.address, candidate3.address],
                id: await ElectionModule.calculateBallotId([
                  candidate2.address,
                  candidate3.address,
                ]),
              };
            });

            before('vote', async function () {
              await ElectionModule.connect(voter1).elect(ballot1.candidates);
              await ElectionModule.connect(voter2).elect(ballot2.candidates);
              await ElectionModule.connect(voter3).elect(ballot1.candidates);
              await ElectionModule.connect(voter4).elect(ballot1.candidates);
              await ElectionModule.connect(voter5).elect(ballot2.candidates);
            });

            it('can retrieve the corresponding ballot that users voted on', async function () {
              assert.equal(await ElectionModule.getBallotVoted(voter1.address), ballot1.id);
              assert.equal(await ElectionModule.getBallotVoted(voter2.address), ballot2.id);
              assert.equal(await ElectionModule.getBallotVoted(voter3.address), ballot1.id);
              assert.equal(await ElectionModule.getBallotVoted(voter4.address), ballot1.id);
              assert.equal(await ElectionModule.getBallotVoted(voter5.address), ballot2.id);
            });

            it('can retrieve ballot votes', async function () {
              assertBn.eq(await ElectionModule.getBallotVotes(ballot1.id), 3);
              assertBn.eq(await ElectionModule.getBallotVotes(ballot2.id), 2);
            });

            it('can retrive ballot candidates', async function () {
              assert.deepEqual(
                await ElectionModule.getBallotCandidates(ballot1.id),
                ballot1.candidates
              );
              assert.deepEqual(
                await ElectionModule.getBallotCandidates(ballot2.id),
                ballot2.candidates
              );
            });

            describe('when trying to retrieve candidates for a ballot that was not voted on', function () {
              it('reverts', async function () {
                await assertRevert(
                  ElectionModule.getBallotCandidates(ballot3.id),
                  'BallotDoesNotExist'
                );
              });
            });

            describe('when trying to retrieve votes for a ballot that was not voted on', function () {
              it('reverts', async function () {
                await assertRevert(ElectionModule.getBallotVotes(ballot3.id), 'BallotDoesNotExist');
              });
            });

            describe('when users change their vote', function () {
              before('change vote', async function () {
                await ElectionModule.connect(voter5).elect(ballot3.candidates);
              });

              it('can retrieve the corresponding ballot that users voted on', async function () {
                assert.equal(await ElectionModule.getBallotVoted(voter5.address), ballot3.id);
              });

              it('can retrieve ballot votes', async function () {
                assertBn.eq(await ElectionModule.getBallotVotes(ballot1.id), 3);
                assertBn.eq(await ElectionModule.getBallotVotes(ballot2.id), 1);
                assertBn.eq(await ElectionModule.getBallotVotes(ballot3.id), 1);
              });

              it('can retrive ballot candidates', async function () {
                assert.deepEqual(
                  await ElectionModule.getBallotCandidates(ballot3.id),
                  ballot3.candidates
                );
              });
            });
          });
        });
      });
    });
  });
});
