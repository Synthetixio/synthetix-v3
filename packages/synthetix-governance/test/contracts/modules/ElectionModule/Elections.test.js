const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { ElectionPeriod } = require('@synthetixio/core-modules/test/contracts/modules/ElectionModule/helpers/election-helper');
const {
  simulateDebtShareData,
  simulateCrossChainDebtShareData,
  expectedDebtShare,
  expectedVotePower,
  expectedCrossChainDebtShare,
  getCrossChainMerkleTree,
} = require('./helpers/debt-share-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe.only('SynthetixElectionModule - general elections', function () {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, DebtShare;

  let owner;
  let user1, user2, user3, user4, user5, user6, user7, user8, user9;

  let receipt;

  let merkleTree;

  let debtShareSnapshotId, debtShareSnapshotBlockNumber;

  const epochData = {
    0: {
      snapshotId: 42,
      blockNumber: 21000000,
    },
    1: {
      snapshotId: 1337,
      blockNumber: 23100007,
    },
    2: {
      snapshotId: 2192,
      blockNumber: 30043001,
    },
  }

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [owner, user1, user2, user3, user4, user5, user6, user7, user8, user9] = users;
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

    before('set next epoch seat count to 3', async function () {
      (await ElectionModule.setNextEpochSeatCount(3)).wait();
    });

    it('shows that the election module is initialized', async function () {
      assert.equal(await ElectionModule.isElectionModuleInitialized(), true);
    });

    it('shows that the current epoch index is zero', async function () {
      assertBn.equal(await ElectionModule.getEpochIndex(), 0);
    });

    it('shows that the current period is Administration', async function () {
      assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Administration);
    });

    it('shows that the DebtShare contract is connected', async function () {
      assert.equal(await ElectionModule.getDebtShareContract(), DebtShare.address);
    });

    describe('before a debt share snapshot is set', function () {
      describe('when trying to retrieve the current debt share snapshot id', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getDebtShareSnapshotId(),
            'DebtShareSnapshotIdNotSet'
          );
        });
      });

      describe('when trying to retrieve the current debt share of a user', function () {
        it('returns zero', async function () {
          assertBn.equal(await ElectionModule.getDebtShare(user1.address), 0);
        });
      });
    });

    describe('before a merkle root is set', function () {
      describe('when trying to retrieve the current cross chain merkle root', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getCrossChainDebtShareMerkleRoot(),
            'MerkleRootNotSet'
          );
        });
      });

      describe('when trying to retrieve the current cross chain merkle root block number', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getCrossChainDebtShareMerkleRootBlockNumber(),
            'MerkleRootNotSet'
          );
        });
      });

      describe('when trying to retrieve the current cross chain debt share of a user', function () {
        it('returns zero', async function () {
          assertBn.equal(await ElectionModule.getDeclaredCrossChainDebtShare(user1.address), 0);
        });
      });
    });

    describe('before the nomination period begins', function () {
      describe('when trying to set the debt share id', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.setDebtShareSnapshotId(0),
            'NotCallableInCurrentPeriod'
          );
        });
      });

      describe('when trying to set the cross chain debt share merkle root', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.setCrossChainDebtShareMerkleRoot('0x000000000000000000000000000000000000000000000000000000000000beef', 1337),
            'NotCallableInCurrentPeriod'
          );
        });
      });
    });

    describe('when advancing to the nominations period', function () {
      before('fast forward', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      describe('when the current epochs debt share snapshot id is set', function () {
        before('simulate debt share data', async function () {
          await simulateDebtShareData(DebtShare, [user1, user2, user3]);
        });

        before('set snapshot id', async function () {
          debtShareSnapshotId = epochData[0].snapshotId;
          debtShareSnapshotBlockNumber = epochData[0].blockNumber;

          const tx = await ElectionModule.setDebtShareSnapshotId(debtShareSnapshotId);
          receipt = await tx.wait();
        });

        it('emitted a DebtShareSnapshotIdSet event', async function () {
          const event = findEvent({ receipt, eventName: 'DebtShareSnapshotIdSet' });

          assert.ok(event);
          assertBn.equal(event.args.snapshotId, debtShareSnapshotId);
        });

        it('shows that the snapshot id is set', async function () {
          assertBn.equal(await ElectionModule.getDebtShareSnapshotId(), debtShareSnapshotId);
        });

        it('shows that users have the expected debt shares', async function () {
          assert.deepEqual(
            await ElectionModule.getDebtShare(user1.address),
            expectedDebtShare(user1.address, debtShareSnapshotId)
          );
          assert.deepEqual(
            await ElectionModule.getDebtShare(user2.address),
            expectedDebtShare(user2.address, debtShareSnapshotId)
          );
          assert.deepEqual(
            await ElectionModule.getDebtShare(user3.address),
            expectedDebtShare(user3.address, debtShareSnapshotId)
          );
        });

        it('shows that users have the expected vote power (cross chain component is zero)', async function () {
          assert.deepEqual(
            await ElectionModule.getVotePower(user1.address),
            expectedVotePower(user1.address, debtShareSnapshotId)
          );
          assert.deepEqual(
            await ElectionModule.getVotePower(user2.address),
            expectedVotePower(user2.address, debtShareSnapshotId)
          );
          assert.deepEqual(
            await ElectionModule.getVotePower(user3.address),
            expectedVotePower(user3.address, debtShareSnapshotId)
          );
        });

        describe('when the current epochs cross chain debt share merkle proof is set', function () {
          before('simulate cross chain debt share data', async function () {
            await simulateCrossChainDebtShareData([user1, user2, user3]);
          });

          before('set the merkle root', async function () {
            merkleTree = getCrossChainMerkleTree(debtShareSnapshotId);

            const tx = await ElectionModule.setCrossChainDebtShareMerkleRoot(merkleTree.merkleRoot, debtShareSnapshotBlockNumber);
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

          it('emitted a CrossChainDebtShareMerkleRootSet event', async function () {
            const event = findEvent({ receipt, eventName: 'CrossChainDebtShareMerkleRootSet' });

            assert.ok(event);
            assertBn.equal(event.args.merkleRoot, merkleTree.merkleRoot);
            assertBn.equal(event.args.blocknumber, debtShareSnapshotBlockNumber);
          });

          it('shows that the merkle root is set', async function () {
            assert.equal(await ElectionModule.getCrossChainDebtShareMerkleRoot(), merkleTree.merkleRoot);
          });

          it('shows that the merkle root block number is set', async function () {
            assertBn.equal(await ElectionModule.getCrossChainDebtShareMerkleRootBlockNumber(), debtShareSnapshotBlockNumber);
          });

          describe('when users declare their cross chain debt shares in the wrong period', function () {
            it('reverts', async function () {
              await assertRevert(
                ElectionModule.declareCrossChainDebtShare(user1.address, expectedCrossChainDebtShare(user1.address, debtShareSnapshotId), merkleTree.claims[user1.address].proof),
                'NotCallableInCurrentPeriod'
              );
            });
          });

          describe('when advancing to the voting period', function () {
            before('fast forward', async function () {
              await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
            });

            it('shows that the current period is Voting', async function () {
              assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Vote);
            });

            describe('when users declare their cross chain debt shares incorrectly', function () {
              describe('when a user declares a wrong amount', function () {
                it('reverts', async function () {
                  const { proof } = merkleTree.claims[user2.address];

                  await assertRevert(
                    ElectionModule.declareCrossChainDebtShare(
                      user2.address,
                      ethers.utils.parseEther('10000000'),
                      proof
                    ),
                    'InvalidMerkleProof'
                  );
                });
              });

              describe('when a user with no entry in the tree declares an amount', function () {
                it('reverts', async function () {
                  const { proof } = merkleTree.claims[user2.address];

                  await assertRevert(
                    ElectionModule.declareCrossChainDebtShare(
                      user4.address,
                      ethers.utils.parseEther('1000'),
                      proof
                    ),
                    'InvalidMerkleProof'
                  );
                });
              });

              describe('when a user uses the wrong tree to declare', function () {
                it('reverts', async function () {
                  const anotherTree = getCrossChainMerkleTree(2192);
                  const { amount, proof } = anotherTree.claims[user2.address];

                  await assertRevert(
                    ElectionModule.declareCrossChainDebtShare(
                      user2.address,
                      amount,
                      proof
                    ),
                    'InvalidMerkleProof'
                  );
                });
              });
            });

            describe('when users declare their cross chain debt shares correctly', function () {
              async function declare(user) {
                const { amount, proof } = merkleTree.claims[user.address];

                const tx = await ElectionModule.declareCrossChainDebtShare(user.address, amount, proof);
                receipt = await tx.wait();
              }

              before('declare', async function () {
                await declare(user1);
                await declare(user2);
                await declare(user3);
              });

              it('emitted a CrossChainDebtShareDeclared event', async function () {
                const event = findEvent({ receipt, eventName: 'CrossChainDebtShareDeclared' });

                assert.ok(event);
                assertBn.equal(event.args.user, user3.address);
                assertBn.equal(event.args.debtShare, expectedCrossChainDebtShare(user3.address, debtShareSnapshotId));
              });

              it('shows that users have declared their cross chain debt shares', async function () {
                assertBn.equal(await ElectionModule.getDeclaredCrossChainDebtShare(user1.address), expectedCrossChainDebtShare(user1.address, debtShareSnapshotId));
                assertBn.equal(await ElectionModule.getDeclaredCrossChainDebtShare(user2.address), expectedCrossChainDebtShare(user2.address, debtShareSnapshotId));
                assertBn.equal(await ElectionModule.getDeclaredCrossChainDebtShare(user3.address), expectedCrossChainDebtShare(user3.address, debtShareSnapshotId));
              });

              it('shows that users have the expected vote power (cross chain component is now declared)', async function () {
                assert.deepEqual(
                  await ElectionModule.getVotePower(user1.address),
                  expectedVotePower(user1.address, debtShareSnapshotId)
                );
                assert.deepEqual(
                  await ElectionModule.getVotePower(user2.address),
                  expectedVotePower(user2.address, debtShareSnapshotId)
                );
                assert.deepEqual(
                  await ElectionModule.getVotePower(user3.address),
                  expectedVotePower(user3.address, debtShareSnapshotId)
                );
              });

              describe('when a user tries to vote for more than one candidate', function () {
                it('reverts', async function () {
                  await assertRevert(
                    ElectionModule.connect(user1).cast([user4.address, user5.address]),
                    'TooManyCandidates'
                  );
                });
              });

              // TODO: Vote, track votes in ballots

              // TODO: Evaluate, resolve, and check winners

              // TODO: Repeat for other 2 periods
            });
          });
        });
      });
    });
  });
});
