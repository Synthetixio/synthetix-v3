const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const { runElection, assertDatesAreClose } = require('./helpers/election-helper');

describe('ElectionModule (inspector)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, ElectionInspectorModule;

  let owner;
  let member1, member2, member3, member4, member5;

  let noBallot, ballot1, ballot2, ballot3, ballot4, ballot5;

  const epochData = [];

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [owner, member1, member2, member3, member4, member5] = users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );

    ElectionInspectorModule = await ethers.getContractAt(
      'contracts/modules/ElectionInspectorModule.sol:ElectionInspectorModule',
      proxyAddress()
    );
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(14);

      epochData.push({
        startDate: now,
        endDate: epochEndDate,
        nominationPeriodStartDate,
        votingPeriodStartDate,
      });

      await ElectionModule.initializeElectionModule(
        'Spartan Council Token',
        'SCT',
        [owner.address],
        1,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate
      );
    });

    async function collectEpochData() {
      epochData.push({
        startDate: await getTime(ethers.provider),
        endDate: await ElectionModule.getEpochEndDate(),
        nominationPeriodStartDate: await ElectionModule.getNominationPeriodStartDate(),
        votingPeriodStartDate: await ElectionModule.getVotingPeriodStartDate(),
      });
    }

    describe('epoch 0', function () {
      before('run election', async function () {
        await runElection(ElectionModule, owner, [member1, member2, member3]);
      });

      describe('epoch 1', function () {
        before('collect info about the epoch', async function () {
          await collectEpochData();
        });

        before('run election', async function () {
          await runElection(ElectionModule, owner, [member2, member3, member4]);
        });

        describe('epoch 2', function () {
          before('collect info about the epoch', async function () {
            await collectEpochData();
          });

          before('run election', async function () {
            await runElection(ElectionModule, owner, [member3, member4, member5]);
          });

          describe('epoch 3', function () {
            before('collect info about the epoch', async function () {
              await collectEpochData();
            });

            before('calculate ballot hashes', async function () {
              noBallot = '0x0000000000000000000000000000000000000000000000000000000000000000';
              ballot1 = await ElectionModule.calculateBallotId([member1.address]);
              ballot2 = await ElectionModule.calculateBallotId([member2.address]);
              ballot3 = await ElectionModule.calculateBallotId([member3.address]);
              ballot4 = await ElectionModule.calculateBallotId([member4.address]);
              ballot5 = await ElectionModule.calculateBallotId([member5.address]);
            });

            it('can retrieve past epoch start dates', async function () {
              epochData.forEach(async (epoch, idx) =>
                assertDatesAreClose(
                  await ElectionInspectorModule.getEpochStartDateForIndex(idx),
                  epoch.startDate
                )
              );
            });

            it('can retrieve past epoch nomination period start dates', async function () {
              epochData.forEach(async (epoch, idx) =>
                assertDatesAreClose(
                  await ElectionInspectorModule.getNominationPeriodStartDateForIndex(idx),
                  epoch.nominationPeriodStartDate
                )
              );
            });

            it('can retrieve past epoch nomination period start dates', async function () {
              epochData.forEach(async (epoch, idx) =>
                assertDatesAreClose(
                  await ElectionInspectorModule.getVotingPeriodStartDateForIndex(idx),
                  epoch.votingPeriodStartDate
                )
              );
            });

            it('can retrieve past epoch end dates', async function () {
              epochData.forEach(async (epoch, idx) =>
                assertDatesAreClose(
                  await ElectionInspectorModule.getEpochEndDateForIndex(idx),
                  epoch.endDate
                )
              );
            });

            it('can remember if a candidate was nominated', async function () {
              assert.equal(await ElectionInspectorModule.wasNominated(member1.address, 0), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member2.address, 0), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member3.address, 0), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member4.address, 0), false);
              assert.equal(await ElectionInspectorModule.wasNominated(member5.address, 0), false);

              assert.equal(await ElectionInspectorModule.wasNominated(member1.address, 1), false);
              assert.equal(await ElectionInspectorModule.wasNominated(member2.address, 1), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member3.address, 1), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member4.address, 1), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member5.address, 1), false);

              assert.equal(await ElectionInspectorModule.wasNominated(member1.address, 2), false);
              assert.equal(await ElectionInspectorModule.wasNominated(member2.address, 2), false);
              assert.equal(await ElectionInspectorModule.wasNominated(member3.address, 2), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member4.address, 2), true);
              assert.equal(await ElectionInspectorModule.wasNominated(member5.address, 2), true);
            });

            it('can remember if a user has voted in past epochs', async function () {
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member1.address, 0), true);
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member2.address, 0), true);
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member3.address, 0), true);
              assert.equal(
                await ElectionInspectorModule.hasVotedInEpoch(member4.address, 0),
                false
              );
              assert.equal(
                await ElectionInspectorModule.hasVotedInEpoch(member5.address, 0),
                false
              );

              assert.equal(
                await ElectionInspectorModule.hasVotedInEpoch(member1.address, 1),
                false
              );
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member2.address, 1), true);
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member3.address, 1), true);
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member4.address, 1), true);
              assert.equal(
                await ElectionInspectorModule.hasVotedInEpoch(member5.address, 1),
                false
              );

              assert.equal(
                await ElectionInspectorModule.hasVotedInEpoch(member1.address, 2),
                false
              );
              assert.equal(
                await ElectionInspectorModule.hasVotedInEpoch(member2.address, 2),
                false
              );
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member3.address, 2), true);
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member4.address, 2), true);
              assert.equal(await ElectionInspectorModule.hasVotedInEpoch(member5.address, 2), true);
            });

            it('can recall the number of votes for ballots in past epochs', async function () {
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot1, 0), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot2, 0), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot3, 0), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot4, 0), 0);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot5, 0), 0);

              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot1, 1), 0);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot2, 1), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot3, 1), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot4, 1), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot5, 1), 0);

              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot1, 2), 0);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot2, 2), 0);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot3, 2), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot4, 2), 1);
              assertBn.equal(await ElectionInspectorModule.getBallotVotesInEpoch(ballot5, 2), 1);
            });

            it('can recall the nominees of past epochs', async function () {
              assert.deepEqual(await ElectionInspectorModule.getNomineesAtEpoch(0), [
                member1.address,
                member2.address,
                member3.address,
              ]);
              assert.deepEqual(await ElectionInspectorModule.getNomineesAtEpoch(1), [
                member2.address,
                member3.address,
                member4.address,
              ]);
              assert.deepEqual(await ElectionInspectorModule.getNomineesAtEpoch(2), [
                member3.address,
                member4.address,
                member5.address,
              ]);
            });

            it('can recall the winners of past epochs', async function () {
              assert.deepEqual(await ElectionInspectorModule.getElectionWinnersInEpoch(0), [
                member1.address,
                member2.address,
                member3.address,
              ]);
              assert.deepEqual(await ElectionInspectorModule.getElectionWinnersInEpoch(1), [
                member2.address,
                member3.address,
                member4.address,
              ]);
              assert.deepEqual(await ElectionInspectorModule.getElectionWinnersInEpoch(2), [
                member3.address,
                member4.address,
                member5.address,
              ]);
            });

            it('can recall the candidates of ballots for past epochs', async function () {
              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot1, 0),
                [member1.address]
              );
              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot2, 0),
                [member2.address]
              );
              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot3, 0),
                [member3.address]
              );

              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot2, 1),
                [member2.address]
              );
              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot3, 1),
                [member3.address]
              );
              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot4, 1),
                [member4.address]
              );

              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot3, 2),
                [member3.address]
              );
              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot4, 2),
                [member4.address]
              );
              assert.deepEqual(
                await ElectionInspectorModule.getBallotCandidatesInEpoch(ballot5, 2),
                [member5.address]
              );
            });

            it('can record the votes on candidates for past epochs', async function () {
              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member1.address, 0),
                1
              );
              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member2.address, 0),
                1
              );
              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member3.address, 0),
                1
              );

              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member2.address, 1),
                1
              );
              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member3.address, 1),
                1
              );
              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member4.address, 1),
                1
              );

              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member3.address, 2),
                1
              );
              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member4.address, 2),
                1
              );
              assertBn.equal(
                await ElectionInspectorModule.getCandidateVotesInEpoch(member5.address, 2),
                1
              );
            });

            it('can recall which ballot users voted on for past epochs', async function () {
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member1.address, 0),
                ballot1
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member2.address, 0),
                ballot2
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member3.address, 0),
                ballot3
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member4.address, 0),
                noBallot
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member5.address, 0),
                noBallot
              );

              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member1.address, 1),
                noBallot
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member2.address, 1),
                ballot2
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member3.address, 1),
                ballot3
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member4.address, 1),
                ballot4
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member5.address, 1),
                noBallot
              );

              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member1.address, 2),
                noBallot
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member2.address, 2),
                noBallot
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member3.address, 2),
                ballot3
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member4.address, 2),
                ballot4
              );
              assert.equal(
                await ElectionInspectorModule.getBallotVotedAtEpoch(member5.address, 2),
                ballot5
              );
            });
          });
        });
      });
    });
  });
});
