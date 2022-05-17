const assert = require('assert/strict');
const { ethers } = require('hardhat');
const synthetix = require('synthetix');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const initializer = require('../helpers/initializer');

const ElectionPeriod = {
  Administration: 0,
  Nomination: 1,
  Vote: 2,
  Evaluation: 3,
};

describe('SynthetixElectionModule - integration (cast)', function () {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, SynthetixDebtShare;

  let candidate1, candidate2, candidate3, candidate4;
  let voter1, voter2, voter3, voter4, voter5;

  let ballot1, ballot2, ballot3;

  function fundSignerWallet(signer) {
    return hre.network.provider.request({
      method: 'hardhat_setBalance',
      params: [signer.address, '0x10000000000000000000000'],
    });
  }

  async function impersonateAndCast(signer, ...args) {
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [signer.address],
    });

    return ElectionModule.connect(signer).cast(...args);
  }

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [candidate1, candidate2, candidate3, candidate4] = users;

    // Random addresses with real debt
    [voter1, voter2, voter3, voter4, voter5] = await Promise.all([
      ethers.getSigner('0x0a653bd08E2B0A80d1D212d33032953Db8298efd'),
      ethers.getSigner('0x1d3666a6B38A3B7eb22a98f62B2E52A44890450F'),
      ethers.getSigner('0x215B67D707cEd250c3803a19348E9C565E42d7A3'),
      ethers.getSigner('0x2ce5f9f52C1eec9a1183f91139C59b485Ff39dAd'),
      ethers.getSigner('0x391Da6221fde9C73472F0cF6CbDB280359CFb32F'),
    ]);
  });

  before('give funds to voters', async function () {
    await Promise.all([
      fundSignerWallet(voter1),
      fundSignerWallet(voter2),
      fundSignerWallet(voter3),
      fundSignerWallet(voter4),
      fundSignerWallet(voter5),
    ]);
  });

  before('identify modules', async function () {
    ElectionModule = await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );
  });

  before('initialize SynthetixDebtShare', async function () {
    const { address } = synthetix.getTarget({ network: 'mainnet-ovm' }).SynthetixDebtShare;
    const { abi } = synthetix.getSource({ network: 'mainnet-ovm' }).SynthetixDebtShare;

    SynthetixDebtShare = await ethers.getContractAt(abi, address);

    const ownerAddress = await SynthetixDebtShare.owner();
    const owner = await ethers.getSigner(ownerAddress);

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [ownerAddress],
    });

    await fundSignerWallet(owner);

    await SynthetixDebtShare.connect(owner).addAuthorizedToSnapshot(proxyAddress());
  });

  before('initialize ElectionModule', async function () {
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
      SynthetixDebtShare.address
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
              await assertRevert(impersonateAndCast(voter1, []), 'NoCandidates');
            });
          });

          describe('when voting candidates that are not nominated', function () {
            it('reverts', async function () {
              await assertRevert(
                impersonateAndCast(voter1, [
                  candidate1.address,
                  candidate2.address,
                  voter1.address,
                ]),
                'NotNominated'
              );
            });
          });

          describe('when voting duplicate candidates', function () {
            it('reverts', async function () {
              await assertRevert(
                impersonateAndCast(voter1, [
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
          const debts = await Promise.all([
            ElectionModule.getVotePower(voter1.address),
            ElectionModule.getVotePower(voter2.address),
            ElectionModule.getVotePower(voter3.address),
            ElectionModule.getVotePower(voter4.address),
          ]);

          assertBn.equal(debts[0], ethers.BigNumber.from('357079901261'));
          assertBn.equal(debts[1], ethers.BigNumber.from('380079625183'));
          assertBn.equal(debts[2], ethers.BigNumber.from('350535401183'));
          assertBn.equal(debts[3], ethers.BigNumber.from('383760657789'));
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
              await assertRevert(ElectionModule.withdrawVote(), 'VoteNotCasted');
            });
          });
        });

        describe('when issuing valid votes', function () {
          let receipt;

          before('form ballots', async function () {
            ballot1 = {
              candidates: [candidate1.address],
              id: await ElectionModule.calculateBallotId([candidate1.address]),
            };
            ballot2 = {
              candidates: [candidate2.address, candidate4.address],
              id: await ElectionModule.calculateBallotId([candidate2.address, candidate4.address]),
            };
            ballot3 = {
              candidates: [candidate3.address],
              id: await ElectionModule.calculateBallotId([candidate3.address]),
            };
          });

          before('vote', async function () {
            await impersonateAndCast(voter1, ballot1.candidates);
            await impersonateAndCast(voter2, ballot2.candidates);
            await impersonateAndCast(voter3, ballot1.candidates);
            await impersonateAndCast(voter4, ballot1.candidates);
          });

          before('vote and record receipt', async function () {
            const tx = await impersonateAndCast(voter5, ballot2.candidates);
            receipt = await tx.wait();
          });

          it('emitted a VoteRecorded event', async function () {
            const event = findEvent({ receipt, eventName: 'VoteRecorded' });

            assert.ok(event);
            assertBn.equal(event.args.voter, voter5.address);
            assert.equal(event.args.ballotId, ballot2.id);
            assertBn.equal(event.args.votePower, ethers.BigNumber.from('430359032721'));
            assertBn.equal(event.args.epochIndex, 0);
          });

          it('can retrieve the corresponding ballot that users voted on', async function () {
            assert.equal(await ElectionModule.getBallotVoted(voter1.address), ballot1.id);
            assert.equal(await ElectionModule.getBallotVoted(voter2.address), ballot2.id);
            assert.equal(await ElectionModule.getBallotVoted(voter3.address), ballot1.id);
            assert.equal(await ElectionModule.getBallotVoted(voter4.address), ballot1.id);
            assert.equal(await ElectionModule.getBallotVoted(voter5.address), ballot2.id);
          });

          it('can retrieve ballot votes', async function () {
            assertBn.equal(
              await ElectionModule.getBallotVotes(ballot1.id),
              ethers.BigNumber.from('1091375960233')
            );
            assertBn.equal(
              await ElectionModule.getBallotVotes(ballot2.id),
              ethers.BigNumber.from('810438657904')
            );
            assertBn.equal(
              await ElectionModule.getBallotVotes(ballot3.id),
              ethers.BigNumber.from('0')
            );
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
              const tx = await impersonateAndCast(voter5, ballot3.candidates);
              receipt = await tx.wait();
            });

            it('emitted VoteWithdrawn and VoteRecorded events', async function () {
              let event;

              event = findEvent({ receipt, eventName: 'VoteWithdrawn' });
              assert.ok(event);
              assertBn.equal(event.args.voter, voter5.address);
              assert.equal(event.args.ballotId, ballot2.id);
              assertBn.equal(event.args.votePower, ethers.BigNumber.from('430359032721'));
              assertBn.equal(event.args.epochIndex, 0);

              event = findEvent({ receipt, eventName: 'VoteRecorded' });
              assert.ok(event);
              assertBn.equal(event.args.voter, voter5.address);
              assert.equal(event.args.ballotId, ballot3.id);
              assertBn.equal(event.args.votePower, ethers.BigNumber.from('430359032721'));
              assertBn.equal(event.args.epochIndex, 0);
            });

            it('can retrieve the corresponding ballot that users voted on', async function () {
              assert.equal(await ElectionModule.getBallotVoted(voter5.address), ballot3.id);
            });

            it('can retrieve ballot votes', async function () {
              assertBn.equal(
                await ElectionModule.getBallotVotes(ballot1.id),
                ethers.BigNumber.from('1091375960233')
              );
              assertBn.equal(
                await ElectionModule.getBallotVotes(ballot2.id),
                ethers.BigNumber.from('380079625183')
              );
              assertBn.equal(
                await ElectionModule.getBallotVotes(ballot3.id),
                ethers.BigNumber.from('430359032721')
              );
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
              const event = findEvent({ receipt, eventName: 'VoteWithdrawn' });
              assert.ok(event);
              assertBn.equal(event.args.voter, voter4.address);
              assert.equal(event.args.ballotId, ballot1.id);
              assertBn.equal(event.args.votePower, '383760657789');
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
              assertBn.equal(
                await ElectionModule.getBallotVotes(ballot1.id),
                ethers.BigNumber.from('707615302444')
              );
              assertBn.equal(
                await ElectionModule.getBallotVotes(ballot2.id),
                ethers.BigNumber.from('380079625183')
              );
              assertBn.equal(
                await ElectionModule.getBallotVotes(ballot3.id),
                ethers.BigNumber.from('430359032721')
              );
            });
          });
        });
      });
    });
  });
});
