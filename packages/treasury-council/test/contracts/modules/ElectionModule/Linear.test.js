const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const {
  getTime,
  fastForwardTo,
  takeSnapshot,
  restoreSnapshot,
} = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const {
  ElectionPeriod,
} = require('@synthetixio/core-modules/test/contracts/modules/ElectionModule/helpers/election-helper');
const {
  simulateDebtShareData,
  simulateCrossChainDebtShareData,
  expectedDebtShare,
  expectedVotePower,
  expectedCrossChainDebtShare,
  getCrossChainMerkleTree,
} = require('@synthetixio/synthetix-governance/test/contracts/modules/ElectionModule/helpers/debt-share-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('SynthetixElectionModule - treasury-council (linear voting)', function () {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, DebtShare, CouncilToken;

  let owner;
  let user1, user2, user3, user4, user5, user6, user7, user8, user9;

  let receipt;

  let merkleTree;

  let snapshotId;

  const epochData = [
    {
      index: 0,
      debtShareSnapshotId: 42,
      blockNumber: 21000000,
      winners: () => [user4.address, user5.address],
    }
  ];

  before('identify signers', async () => {
    [owner, user1, user2, user3, user4, user5, user6, user7, user8, user9] =
      await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );
  });

  before('deploy debt shares mock', async function () {
    const factory = await ethers.getContractFactory('DebtShareMock');
    DebtShare = await factory.deploy();
  });

  describe('when the election module is initialized', function () {
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
        [owner.address],
        1,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate,
        DebtShare.address
      );
    });

    before('set next epoch seat count to 2', async function () {
      (await ElectionModule.setNextEpochSeatCount(2)).wait();
    });

    before('identify the council token', async function () {
      CouncilToken = await ethers.getContractAt(
        'CouncilToken',
        await ElectionModule.getCouncilToken()
      );
    });

    epochData.forEach(function (epoch) {
      describe(`epoch ${epoch.index} with debt share snapshot ${epoch.debtShareSnapshotId}`, function () {
        describe('when advancing to the nominations period', function () {
          before('fast forward', async function () {
            await fastForwardTo(
              await ElectionModule.getNominationPeriodStartDate(),
              ethers.provider
            );
          });

          describe('when the current epochs debt share snapshot id is set', function () {
            before('simulate debt share data', async function () {
              await simulateDebtShareData(DebtShare, [user1, user2, user3, user4, user5]);
            });

            before('set snapshot id', async function () {
              const tx = await ElectionModule.setDebtShareSnapshotId(epoch.debtShareSnapshotId);
              receipt = await tx.wait();
            });

            describe('when cross chain debt share data is collected', function () {
              before('simulate cross chain debt share data', async function () {
                await simulateCrossChainDebtShareData([user1, user2, user3]);

                merkleTree = getCrossChainMerkleTree(epoch.debtShareSnapshotId);
              });

              describe('when the current epochs cross chain debt share merkle root is set', function () {
                before('set the merkle root', async function () {
                  const tx = await ElectionModule.setCrossChainDebtShareMerkleRoot(
                    merkleTree.merkleRoot,
                    epoch.blockNumber
                  );
                  receipt = await tx.wait();
                });

                before('nominate', async function () {
                  (await ElectionModule.connect(user4).nominate()).wait();
                  (await ElectionModule.connect(user5).nominate()).wait();
                  (await ElectionModule.connect(user6).nominate()).wait();
                  (await ElectionModule.connect(user7).nominate()).wait();
                  (await ElectionModule.connect(user8).nominate()).wait();
                  (await ElectionModule.connect(user9).nominate()).wait();
                });

                describe('when advancing to the voting period', function () {
                  before('fast forward', async function () {
                    await fastForwardTo(
                      await ElectionModule.getVotingPeriodStartDate(),
                      ethers.provider
                    );
                  });

                  describe('when users declare their cross chain debt shares correctly', function () {
                    async function declare(user) {
                      const { amount, proof } = merkleTree.claims[user.address];

                      const tx = await ElectionModule.declareCrossChainDebtShare(
                        user.address,
                        amount,
                        proof
                      );
                      receipt = await tx.wait();
                    }

                    async function declareAndCast(user, candidates) {
                      const { amount, proof } = merkleTree.claims[user.address];

                      const tx = await ElectionModule.connect(user).declareAndCast(
                        amount,
                        proof,
                        candidates
                      );
                      receipt = await tx.wait();
                    }

                    before('declare', async function () {
                      await declare(user1);
                      await declare(user2);
                      // Note: Intentionally not declaring for user3
                    });

                    it('shows that users have the expected vote power (cross chain component is now declared)', async function () {
                      assert.deepEqual(
                        await ElectionModule.getVotePower(user1.address),
                        expectedVotePower(user1.address, epoch.debtShareSnapshotId)
                      );
                      assert.deepEqual(
                        await ElectionModule.getVotePower(user2.address),
                        expectedVotePower(user2.address, epoch.debtShareSnapshotId)
                      );
                    });

                    describe('when users cast votes', function () {
                      let ballot1, ballot2, ballot3;

                      before('vote', async function () {
                        await ElectionModule.connect(user1).cast([user4.address]);
                        await ElectionModule.connect(user2).cast([user4.address]);
                        await declareAndCast(user3, [user5.address]); // user3 didn't declare cross chain debt shares yet
                        await ElectionModule.connect(user4).cast([user6.address]);
                        await ElectionModule.connect(user5).cast([user4.address]);
                      });

                      before('identify ballots', async function () {
                        ballot1 = await ElectionModule.calculateBallotId([user4.address]);
                        ballot2 = await ElectionModule.calculateBallotId([user5.address]);
                        ballot3 = await ElectionModule.calculateBallotId([user6.address]);
                      });

                      it('keeps track of vote power in each ballot', async function () {
                        const votesBallot1 = expectedVotePower(
                          user1.address,
                          epoch.debtShareSnapshotId
                        )
                          .add(expectedVotePower(user2.address, epoch.debtShareSnapshotId))
                          .add(expectedVotePower(user5.address, epoch.debtShareSnapshotId));
                        const votesBallot2 = expectedVotePower(
                          user3.address,
                          epoch.debtShareSnapshotId
                        );
                        const votesBallot3 = expectedVotePower(
                          user4.address,
                          epoch.debtShareSnapshotId
                        );

                        assertBn.equal(await ElectionModule.getBallotVotes(ballot1), votesBallot1);
                        assertBn.equal(await ElectionModule.getBallotVotes(ballot2), votesBallot2);
                        assertBn.equal(await ElectionModule.getBallotVotes(ballot3), votesBallot3);
                      });

                      describe('when voting ends', function () {
                        before('fast forward', async function () {
                          await fastForwardTo(
                            await ElectionModule.getEpochEndDate(),
                            ethers.provider
                          );
                        });

                        describe('when the election is evaluated', function () {
                          before('evaluate', async function () {
                            (await ElectionModule.evaluate(0)).wait();
                          });

                          it('shows each candidates votes', async function () {
                            const votesUser4 = expectedVotePower(
                              user1.address,
                              epoch.debtShareSnapshotId
                            )
                              .add(expectedVotePower(user2.address, epoch.debtShareSnapshotId))
                              .add(expectedVotePower(user5.address, epoch.debtShareSnapshotId));
                            const votesUser5 = expectedVotePower(
                              user3.address,
                              epoch.debtShareSnapshotId
                            );
                            const votesUser6 = expectedVotePower(
                              user4.address,
                              epoch.debtShareSnapshotId
                            );

                            assertBn.equal(
                              await ElectionModule.getCandidateVotes(user4.address),
                              votesUser4
                            );
                            assertBn.equal(
                              await ElectionModule.getCandidateVotes(user5.address),
                              votesUser5
                            );
                            assertBn.equal(
                              await ElectionModule.getCandidateVotes(user6.address),
                              votesUser6
                            );
                            assertBn.equal(
                              await ElectionModule.getCandidateVotes(user7.address),
                              0
                            );
                            assertBn.equal(
                              await ElectionModule.getCandidateVotes(user8.address),
                              0
                            );
                            assertBn.equal(
                              await ElectionModule.getCandidateVotes(user9.address),
                              0
                            );
                          });

                          it('shows the election winners', async function () {
                            assert.deepEqual(
                              await ElectionModule.getElectionWinners(),
                              epoch.winners()
                            );
                          });

                          describe('when the election is resolved', function () {
                            before('resolve', async function () {
                              (await ElectionModule.resolve()).wait();
                            });

                            it('shows the expected NFT owners', async function () {
                              const winners = epoch.winners();

                              assertBn.equal(
                                await CouncilToken.balanceOf(owner.address),
                                winners.includes(owner.address) ? 1 : 0
                              );
                              assertBn.equal(
                                await CouncilToken.balanceOf(user4.address),
                                winners.includes(user4.address) ? 1 : 0
                              );
                              assertBn.equal(
                                await CouncilToken.balanceOf(user5.address),
                                winners.includes(user5.address) ? 1 : 0
                              );
                              assertBn.equal(
                                await CouncilToken.balanceOf(user6.address),
                                winners.includes(user6.address) ? 1 : 0
                              );
                              assertBn.equal(
                                await CouncilToken.balanceOf(user7.address),
                                winners.includes(user7.address) ? 1 : 0
                              );
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
      });
    });
  });
});
