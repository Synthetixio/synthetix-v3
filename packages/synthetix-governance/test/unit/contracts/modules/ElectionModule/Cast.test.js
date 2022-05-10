const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../helpers/initializer');
const {
  ElectionPeriod,
  expectedVotePowerForDebtSharePeriodId,
} = require('./helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('SynthetixElectionModule (cast)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, DebtShare;

  let candidate1, candidate2, candidate3, candidate4;
  let voter1, voter2, voter3, voter4, voter5;

  let ballot1, ballot2, ballot3;

  let receipt;

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [candidate1, candidate2, candidate3, candidate4] = users;
    [, , , , voter1, voter2, voter3, voter4, voter5] = users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );
  });

  describe('when the module is initialized', function () {
    before('deploy debt shares mock', async function () {
      const factory = await ethers.getContractFactory('DebtShareMock');
      DebtShare = await factory.deploy();
    });

    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule[
        'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
      ](
        'Spartan Council Token',
        'SCT',
        [candidate1.address],
        1,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate,
        DebtShare.address
      );
    });

    describe('when entering the nomiantion period', function () {
      before('fast forward', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
      });

      describe('when nominations exist', function () {
        before('nominate', async function () {
          await ElectionModule.connect(candidate1).nominate();
          await ElectionModule.connect(candidate2).nominate();
          await ElectionModule.connect(candidate3).nominate();
          await ElectionModule.connect(candidate4).nominate();
        });

        describe('when entering the election period', function () {
          before('fast forward', async function () {
            await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
          });

          it('shows that the current period is Vote', async function () {
            assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Vote);
          });

          describe('when issuing invalid votes', function () {
            describe('when voting with zero candidates', function () {
              it('reverts', async function () {
                await assertRevert(ElectionModule.cast([]), 'NoCandidates');
              });
            });

            describe('when voting candidates that are not nominated', function () {
              it('reverts', async function () {
                await assertRevert(
                  ElectionModule.cast([candidate1.address, candidate2.address, voter1.address]),
                  'NotNominated'
                );
              });
            });

            describe('when voting duplicate candidates', function () {
              it('reverts', async function () {
                await assertRevert(
                  ElectionModule.cast([candidate1.address, candidate2.address, candidate1.address]),
                  'DuplicateCandidates'
                );
              });
            });
          });

          it('can retrieve user vote power', async function () {
            assertBn.equal(
              await ElectionModule.getVotePower(voter1.address),
              await expectedVotePowerForDebtSharePeriodId(1)
            );
            assertBn.equal(
              await ElectionModule.getVotePower(voter2.address),
              await expectedVotePowerForDebtSharePeriodId(1)
            );
            assertBn.equal(
              await ElectionModule.getVotePower(voter3.address),
              await expectedVotePowerForDebtSharePeriodId(1)
            );
          });

          describe('before issuing valid votes', function () {
            it('reflects users that have not voted', async function () {
              assert.equal(await ElectionModule.hasVoted(voter1.address), false);
              assert.equal(await ElectionModule.hasVoted(voter2.address), false);
              assert.equal(await ElectionModule.hasVoted(voter3.address), false);
              assert.equal(await ElectionModule.hasVoted(voter4.address), false);
            });

            describe('when attempting to withdraw a vote that does not exist', function () {
              it('reverts', async function () {
                await assertRevert(ElectionModule.withdrawVote(), 'HasNotVoted');
              });
            });
          });

          describe('when issuing valid votes', function () {
            before('form ballots', async function () {
              ballot1 = {
                candidates: [candidate1.address],
                id: await ElectionModule.calculateBallotId([candidate1.address]),
              };
              ballot2 = {
                candidates: [candidate2.address, candidate4.address],
                id: await ElectionModule.calculateBallotId([
                  candidate2.address,
                  candidate4.address,
                ]),
              };
              ballot3 = {
                candidates: [candidate3.address],
                id: await ElectionModule.calculateBallotId([candidate3.address]),
              };
            });

            before('vote', async function () {
              await ElectionModule.connect(voter1).cast(ballot1.candidates);
              await ElectionModule.connect(voter2).cast(ballot2.candidates);
              await ElectionModule.connect(voter3).cast(ballot1.candidates);
              await ElectionModule.connect(voter4).cast(ballot1.candidates);
            });

            before('vote and record receipt', async function () {
              const tx = await ElectionModule.connect(voter5).cast(ballot2.candidates);
              receipt = await tx.wait();
            });

            it('emitted a VoteRecorded event', async function () {
              const event = findEvent({ receipt, eventName: 'VoteRecorded' });

              assert.ok(event);
              assertBn.equal(event.args.voter, voter5.address);
              assert.equal(event.args.ballotId, ballot2.id);
              assertBn.equal(event.args.votePower, await expectedVotePowerForDebtSharePeriodId(1));
            });

            it('can retrieve the corresponding ballot that users voted on', async function () {
              assert.equal(await ElectionModule.getBallotVoted(voter1.address), ballot1.id);
              assert.equal(await ElectionModule.getBallotVoted(voter2.address), ballot2.id);
              assert.equal(await ElectionModule.getBallotVoted(voter3.address), ballot1.id);
              assert.equal(await ElectionModule.getBallotVoted(voter4.address), ballot1.id);
              assert.equal(await ElectionModule.getBallotVoted(voter5.address), ballot2.id);
            });

            it('can retrieve ballot votes', async function () {
              const votePowerUnit = await expectedVotePowerForDebtSharePeriodId(1);

              assertBn.equal(await ElectionModule.getBallotVotes(ballot1.id), votePowerUnit.mul(3));
              assertBn.equal(await ElectionModule.getBallotVotes(ballot2.id), votePowerUnit.mul(2));
              assertBn.equal(await ElectionModule.getBallotVotes(ballot3.id), 0);
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

            it('will retrieve no candidates for ballots that where not voted on', async function () {
              assert.deepEqual(await ElectionModule.getBallotCandidates(ballot3.id), []);
            });

            describe('when users change their vote', function () {
              before('change vote', async function () {
                const tx = await ElectionModule.connect(voter5).cast(ballot3.candidates);
                receipt = await tx.wait();
              });

              it('emitted VoteWithdrawn and VoteRecorded events', async function () {
                let event;

                const votePowerUnit = await expectedVotePowerForDebtSharePeriodId(1);

                event = findEvent({ receipt, eventName: 'VoteWithdrawn' });
                assert.ok(event);
                assertBn.equal(event.args.voter, voter5.address);
                assert.equal(event.args.ballotId, ballot2.id);
                assertBn.equal(event.args.votePower, votePowerUnit);

                event = findEvent({ receipt, eventName: 'VoteRecorded' });
                assert.ok(event);
                assertBn.equal(event.args.voter, voter5.address);
                assert.equal(event.args.ballotId, ballot3.id);
                assertBn.equal(event.args.votePower, votePowerUnit);
              });

              it('can retrieve the corresponding ballot that users voted on', async function () {
                assert.equal(await ElectionModule.getBallotVoted(voter5.address), ballot3.id);
              });

              it('can retrieve ballot votes', async function () {
                const votePowerUnit = await expectedVotePowerForDebtSharePeriodId(1);

                assertBn.equal(
                  await ElectionModule.getBallotVotes(ballot1.id),
                  votePowerUnit.mul(3)
                );
                assertBn.equal(await ElectionModule.getBallotVotes(ballot2.id), votePowerUnit);
                assertBn.equal(await ElectionModule.getBallotVotes(ballot3.id), votePowerUnit);
              });

              it('can retrive ballot candidates', async function () {
                assert.deepEqual(
                  await ElectionModule.getBallotCandidates(ballot3.id),
                  ballot3.candidates
                );
              });
            });

            describe('when users withdraw their vote', function () {
              before('withdraw vote', async function () {
                const tx = await ElectionModule.connect(voter4).withdrawVote();
                receipt = await tx.wait();
              });

              it('emitted a VoteWithdrawn event', async function () {
                const votePowerUnit = await expectedVotePowerForDebtSharePeriodId(1);

                const event = findEvent({ receipt, eventName: 'VoteWithdrawn' });
                assert.ok(event);
                assertBn.equal(event.args.voter, voter4.address);
                assert.equal(event.args.ballotId, ballot1.id);
                assertBn.equal(event.args.votePower, votePowerUnit);
              });

              it('can retrieve the corresponding ballot that users voted on', async function () {
                assert.equal(
                  await ElectionModule.getBallotVoted(voter4.address),
                  '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
              });

              it('shows that the user has not voted', async function () {
                assert.equal(await ElectionModule.hasVoted(voter4.address), false);
              });

              it('can retrieve ballot votes', async function () {
                const votePowerUnit = await expectedVotePowerForDebtSharePeriodId(1);

                assertBn.equal(
                  await ElectionModule.getBallotVotes(ballot1.id),
                  votePowerUnit.mul(2)
                );
                assertBn.equal(await ElectionModule.getBallotVotes(ballot2.id), votePowerUnit);
                assertBn.equal(await ElectionModule.getBallotVotes(ballot3.id), votePowerUnit);
              });
            });
          });
        });
      });
    });
  });
});
