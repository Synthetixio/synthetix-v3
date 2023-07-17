import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import {
  fastForwardTo,
  getTime,
  restoreSnapshot,
  takeSnapshot,
} from '@synthetixio/core-utils/utils/hardhat/rpc';
import { parseBalanceMap } from '@synthetixio/core-utils/utils/merkle-tree/parse-balance-tree';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';
import { ElectionPeriod } from '../constants';
import { DebtShareMock } from '../generated/typechain';
import {
  expectedCrossChainDebtShare,
  expectedDebtShare,
  expectedVotePower,
  getCrossChainMerkleTree,
  simulateCrossChainDebtShareData,
  simulateDebtShareData,
} from '../helpers/debt-share-helper';

describe('SynthetixElectionModule - Elections', function () {
  const { c, getSigners, getProvider } = bootstrap();

  let owner: ethers.Signer;
  let users: ethers.Signer[];
  let addresses: string[];

  let merkleTree: ReturnType<typeof parseBalanceMap>;
  let snapshotId: string;

  const epochs = [
    {
      index: 0,
      debtShareSnapshotId: 42,
      blockNumber: 21000000,
      winners: () => [addresses[3]!, addresses[4]!],
    },
    {
      index: 1,
      debtShareSnapshotId: 1337,
      blockNumber: 23100007,
      winners: () => [addresses[3]!, addresses[5]!],
    },
    {
      index: 2,
      debtShareSnapshotId: 2192,
      blockNumber: 30043001,
      winners: () => [addresses[5]!, addresses[4]!],
    },
  ];

  // TODO: when your testing crosschain functionality,
  // add tests specifically for receivers, check for ccip and mothership, etc.

  before('identify signers', async function () {
    [owner, ...users] = getSigners();
    addresses = await Promise.all(users.map((u) => u.getAddress()));
  });

  describe('when the election module is initialized', function () {
    // before('set next epoch seat count to 2', async function () {
    //   const tx = await c.CoreProxy.setNextEpochSeatCount(2);
    //   await tx.wait();
    // });

    it('shows the expected NFT owners', async function () {
      assertBn.equal(await c.CouncilToken.balanceOf(await owner.getAddress()), 1);
      assertBn.equal(await c.CouncilToken.balanceOf(addresses[0]!), 0);
      assertBn.equal(await c.CouncilToken.balanceOf(addresses[1]!), 0);
      assertBn.equal(await c.CouncilToken.balanceOf(addresses[2]!), 0);
    });

    epochs.forEach(function (epoch) {
      describe(`epoch ${epoch.index} with debt share snapshot ${epoch.debtShareSnapshotId}`, function () {
        it(`shows that the current epoch index is ${epoch.index}`, async function () {
          assertBn.equal(await c.CoreProxy.getEpochIndex(), epoch.index);
        });

        it('shows that the current period is Administration', async function () {
          assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
        });

        describe('before a debt share snapshot is set', function () {
          describe('when trying to retrieve the current debt share snapshot id', function () {
            it('reverts', async function () {
              await assertRevert(c.CoreProxy.getDebtShareSnapshotId(), 'DebtShareSnapshotIdNotSet');
            });
          });

          describe('when trying to retrieve the current debt share of a user', function () {
            it('returns zero', async function () {
              assertBn.equal(await c.CoreProxy.getDebtShare(addresses[0]!), 0);
            });
          });
        });

        describe('before a merkle root is set', function () {
          describe('when trying to retrieve the current cross chain merkle root', function () {
            it('reverts', async function () {
              await assertRevert(
                c.CoreProxy.getCrossChainDebtShareMerkleRoot(),
                'MerkleRootNotSet'
              );
            });
          });

          describe('when trying to retrieve the current cross chain merkle root block number', function () {
            it('reverts', async function () {
              await assertRevert(
                c.CoreProxy.getCrossChainDebtShareMerkleRootBlockNumber(),
                'MerkleRootNotSet'
              );
            });
          });

          describe('when trying to retrieve the current cross chain debt share of a user', function () {
            it('returns zero', async function () {
              assertBn.equal(await c.CoreProxy.getDeclaredCrossChainDebtShare(addresses[0]!), 0);
            });
          });
        });

        describe('before the nomination period begins', function () {
          describe('when trying to set the debt share id', function () {
            it('reverts', async function () {
              await assertRevert(
                c.CoreProxy.setDebtShareSnapshotId(0),
                'NotCallableInCurrentPeriod'
              );
            });
          });

          describe('when trying to set the cross chain debt share merkle root', function () {
            it('reverts', async function () {
              await assertRevert(
                c.CoreProxy.setCrossChainDebtShareMerkleRoot(
                  '0x000000000000000000000000000000000000000000000000000000000000beef',
                  1337
                ),
                'NotCallableInCurrentPeriod'
              );
            });
          });
        });

        describe('when advancing to the nominations period', function () {
          let rx: ethers.ContractReceipt;

          before('fast forward', async function () {
            await fastForwardTo(
              (await c.CoreProxy.getNominationPeriodStartDate()).toNumber(),
              getProvider()
            );
          });

          before('simulate debt share data', async function () {
            await simulateDebtShareData(c.DebtShareMock, [
              users[0]!,
              users[1]!,
              users[2]!,
              users[3]!,
              users[4]!,
            ]);
          });

          before('set snapshot id', async function () {
            const tx = await c.CoreProxy.setDebtShareSnapshotId(epoch.debtShareSnapshotId);
            rx = await tx.wait();
          });

          it('shows that the current period is Nomination', async function () {
            assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Nomination);
          });

          it('emitted a DebtShareSnapshotIdSet event', async function () {
            await assertEvent(
              rx,
              `DebtShareSnapshotIdSet(${epoch.debtShareSnapshotId})`,
              c.CoreProxy
            );
          });

          it('shows that the snapshot id is set', async function () {
            assertBn.equal(await c.CoreProxy.getDebtShareSnapshotId(), epoch.debtShareSnapshotId);
          });

          it('shows that users have the expected debt shares', async function () {
            assert.deepEqual(
              await c.CoreProxy.getDebtShare(addresses[0]!),
              await expectedDebtShare(users[0]!, epoch.debtShareSnapshotId)
            );
            assert.deepEqual(
              await c.CoreProxy.getDebtShare(addresses[1]!),
              await expectedDebtShare(users[1]!, epoch.debtShareSnapshotId)
            );
            assert.deepEqual(
              await c.CoreProxy.getDebtShare(addresses[2]!),
              await expectedDebtShare(users[2]!, epoch.debtShareSnapshotId)
            );
            assert.deepEqual(
              await c.CoreProxy.getDebtShare(addresses[3]!),
              await expectedDebtShare(users[3]!, epoch.debtShareSnapshotId)
            );
            assert.deepEqual(
              await c.CoreProxy.getDebtShare(addresses[4]!),
              await expectedDebtShare(users[4]!, epoch.debtShareSnapshotId)
            );
          });

          describe('when cross chain debt share data is collected', function () {
            before('simulate cross chain debt share data', async function () {
              await simulateCrossChainDebtShareData([users[0]!, users[1]!, users[2]!]);

              merkleTree = getCrossChainMerkleTree(epoch.debtShareSnapshotId);
            });

            describe('when a user attempts to declare cross chain debt shares and the merkle root is not set', function () {
              before('take snapshot', async function () {
                snapshotId = await takeSnapshot(getProvider());
              });

              after('restore snapshot', async function () {
                await restoreSnapshot(snapshotId, getProvider());
              });

              before('fast forward', async function () {
                await fastForwardTo(
                  (await c.CoreProxy.getVotingPeriodStartDate()).toNumber(),
                  getProvider()
                );
              });

              it('reverts', async function () {
                merkleTree = getCrossChainMerkleTree(epoch.debtShareSnapshotId);

                await assertRevert(
                  c.CoreProxy.declareCrossChainDebtShare(
                    addresses[0]!,
                    await expectedCrossChainDebtShare(users[0]!, epoch.debtShareSnapshotId),
                    merkleTree.claims[addresses[0]!].proof
                  ),
                  'MerkleRootNotSet'
                );
              });
            });

            describe('when the current epochs cross chain debt share merkle root is set', function () {
              let receipt: ethers.ContractReceipt;

              before('set the merkle root', async function () {
                const tx = await c.CoreProxy.setCrossChainDebtShareMerkleRoot(
                  merkleTree.merkleRoot,
                  epoch.blockNumber
                );
                receipt = await tx.wait();
              });

              before('nominate', async function () {
                await (await c.CoreProxy.connect(users[3]!).nominate()).wait();
                await (await c.CoreProxy.connect(users[4]!).nominate()).wait();
                await (await c.CoreProxy.connect(users[5]!).nominate()).wait();
                await (await c.CoreProxy.connect(users[6]!).nominate()).wait();
                await (await c.CoreProxy.connect(users[7]!).nominate()).wait();
                await (await c.CoreProxy.connect(users[8]!).nominate()).wait();
              });

              it('emitted a CrossChainDebtShareMerkleRootSet event', async function () {
                await assertEvent(
                  receipt,
                  `CrossChainDebtShareMerkleRootSet("${merkleTree.merkleRoot}", ${epoch.blockNumber}, ${epoch.index})`,
                  c.CoreProxy
                );
              });

              it('shows that the merkle root is set', async function () {
                assert.equal(
                  await c.CoreProxy.getCrossChainDebtShareMerkleRoot(),
                  merkleTree.merkleRoot
                );
              });

              it('shows that the merkle root block number is set', async function () {
                assertBn.equal(
                  await c.CoreProxy.getCrossChainDebtShareMerkleRootBlockNumber(),
                  epoch.blockNumber
                );
              });

              describe('when users declare their cross chain debt shares in the wrong period', function () {
                it('reverts', async function () {
                  await assertRevert(
                    c.CoreProxy.declareCrossChainDebtShare(
                      addresses[0]!,
                      await expectedCrossChainDebtShare(users[0]!, epoch.debtShareSnapshotId),
                      merkleTree.claims[addresses[0]!].proof
                    ),
                    'NotCallableInCurrentPeriod'
                  );
                });
              });

              describe('when advancing to the voting period', function () {
                before('fast forward', async function () {
                  await fastForwardTo(
                    (await c.CoreProxy.getVotingPeriodStartDate()).toNumber(),
                    getProvider()
                  );
                });

                it('shows that the current period is Voting', async function () {
                  assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Vote);
                });

                describe('when users declare their cross chain debt shares incorrectly', function () {
                  describe('when a user declares a wrong amount', function () {
                    it('reverts', async function () {
                      const { proof } = merkleTree.claims[addresses[1]!];

                      await assertRevert(
                        c.CoreProxy.declareCrossChainDebtShare(
                          addresses[1]!,
                          ethers.utils.parseEther('10000000'),
                          proof
                        ),
                        'InvalidMerkleProof'
                      );
                    });
                  });

                  describe('when a user with no entry in the tree declares an amount', function () {
                    it('reverts', async function () {
                      const { proof } = merkleTree.claims[addresses[1]!];

                      await assertRevert(
                        c.CoreProxy.declareCrossChainDebtShare(
                          addresses[3]!,
                          ethers.utils.parseEther('1000'),
                          proof
                        ),
                        'InvalidMerkleProof'
                      );
                    });
                  });

                  describe('when a user uses the wrong tree to declare', function () {
                    it('reverts', async function () {
                      const anotherTree = getCrossChainMerkleTree(666);
                      const { amount, proof } = anotherTree.claims[addresses[1]!];

                      await assertRevert(
                        c.CoreProxy.declareCrossChainDebtShare(addresses[1]!, amount, proof),
                        'InvalidMerkleProof'
                      );
                    });
                  });
                });

                describe('when users declare their cross chain debt shares correctly', function () {
                  async function declare(user: ethers.Signer) {
                    const address = await user.getAddress();
                    const { amount, proof } = merkleTree.claims[address];
                    const tx = await c.CoreProxy.declareCrossChainDebtShare(address, amount, proof);
                    receipt = await tx.wait();
                  }

                  async function declareAndCast(user: ethers.Signer, candidates: string[]) {
                    const { amount, proof } = merkleTree.claims[await user.getAddress()];

                    const tx = await c.CoreProxy.connect(user).declareAndCast(
                      amount,
                      proof,
                      candidates
                    );

                    receipt = await tx.wait();
                  }

                  before('declare', async function () {
                    await declare(users[0]!);
                    await declare(users[1]!);
                    // Note: Intentionally not declaring for users[2]!
                  });

                  describe('when a user attempts to re-declare cross chain debt shares', function () {
                    it('reverts', async function () {
                      const { amount, proof } = merkleTree.claims[addresses[0]!];

                      await assertRevert(
                        c.CoreProxy.declareCrossChainDebtShare(addresses[0]!, amount, proof),
                        'CrossChainDebtShareAlreadyDeclared'
                      );
                    });
                  });

                  it('emitted a CrossChainDebtShareDeclared event', async function () {
                    const debtShare = await expectedCrossChainDebtShare(
                      users[1]!,
                      epoch.debtShareSnapshotId
                    );

                    await assertEvent(
                      receipt,
                      `CrossChainDebtShareDeclared("${addresses[1]!}", ${debtShare})`,
                      c.CoreProxy
                    );
                  });

                  it('shows that users have declared their cross chain debt shares', async function () {
                    assertBn.equal(
                      await c.CoreProxy.getDeclaredCrossChainDebtShare(addresses[0]!),
                      await expectedCrossChainDebtShare(users[0]!, epoch.debtShareSnapshotId)
                    );
                    assertBn.equal(
                      await c.CoreProxy.getDeclaredCrossChainDebtShare(addresses[1]!),
                      await expectedCrossChainDebtShare(users[1]!, epoch.debtShareSnapshotId)
                    );
                  });

                  it('shows that users have the expected vote power (cross chain component is now declared)', async function () {
                    assert.deepEqual(
                      await c.CoreProxy.getVotePower(addresses[0]!),
                      await expectedVotePower(users[0]!, epoch.debtShareSnapshotId)
                    );

                    assert.deepEqual(
                      await c.CoreProxy.getVotePower(addresses[1]!),
                      await expectedVotePower(users[1]!, epoch.debtShareSnapshotId)
                    );
                  });

                  describe('when a user tries to vote for more than one candidate', function () {
                    it('reverts', async function () {
                      await assertRevert(
                        c.CoreProxy.connect(users[0]!).cast([addresses[3]!, addresses[4]!]),
                        'TooManyCandidates'
                      );
                    });
                  });

                  describe('when users cast votes', function () {
                    let ballot1: string;
                    let ballot2: string;
                    let ballot3: string;

                    before('vote', async function () {
                      await c.CoreProxy.connect(users[0]!).cast([addresses[3]!]);
                      await c.CoreProxy.connect(users[1]!).cast([addresses[3]!]);
                      await declareAndCast(users[2]!, [addresses[4]!]); // users[2]! didn't declare cross chain debt shares yet
                      await c.CoreProxy.connect(users[3]!).cast([addresses[5]!]);
                      await c.CoreProxy.connect(users[4]!).cast([addresses[3]!]);
                    });

                    before('identify ballots', async function () {
                      ballot1 = await c.CoreProxy.calculateBallotId([addresses[3]!]);
                      ballot2 = await c.CoreProxy.calculateBallotId([addresses[4]!]);
                      ballot3 = await c.CoreProxy.calculateBallotId([addresses[5]!]);
                    });

                    it('keeps track of which ballot each user voted on', async function () {
                      assert.equal(await c.CoreProxy.getBallotVoted(addresses[0]!), ballot1);
                      assert.equal(await c.CoreProxy.getBallotVoted(addresses[1]!), ballot1);
                      assert.equal(await c.CoreProxy.getBallotVoted(addresses[2]!), ballot2);
                      assert.equal(await c.CoreProxy.getBallotVoted(addresses[3]!), ballot3);
                      assert.equal(await c.CoreProxy.getBallotVoted(addresses[4]!), ballot1);
                    });

                    it('keeps track of the candidates of each ballot', async function () {
                      assert.deepEqual(await c.CoreProxy.getBallotCandidates(ballot1), [
                        addresses[3]!,
                      ]);
                      assert.deepEqual(await c.CoreProxy.getBallotCandidates(ballot2), [
                        addresses[4]!,
                      ]);
                      assert.deepEqual(await c.CoreProxy.getBallotCandidates(ballot3), [
                        addresses[5]!,
                      ]);
                    });

                    it('keeps track of vote power in each ballot', async function () {
                      const votesBallot1 = (
                        await expectedVotePower(users[0]!, epoch.debtShareSnapshotId)
                      )
                        .add(await expectedVotePower(users[1]!, epoch.debtShareSnapshotId))
                        .add(await expectedVotePower(users[4]!, epoch.debtShareSnapshotId));
                      const votesBallot2 = await expectedVotePower(
                        users[2]!,
                        epoch.debtShareSnapshotId
                      );
                      const votesBallot3 = await expectedVotePower(
                        users[3]!,
                        epoch.debtShareSnapshotId
                      );

                      assertBn.equal(await c.CoreProxy.getBallotVotes(ballot1), votesBallot1);
                      assertBn.equal(await c.CoreProxy.getBallotVotes(ballot2), votesBallot2);
                      assertBn.equal(await c.CoreProxy.getBallotVotes(ballot3), votesBallot3);
                    });

                    describe('when voting ends', function () {
                      before('fast forward', async function () {
                        await fastForwardTo(
                          (await c.CoreProxy.getEpochEndDate()).toNumber(),
                          getProvider()
                        );
                      });

                      it('shows that the current period is Evaluation', async function () {
                        assertBn.equal(
                          await c.CoreProxy.getCurrentPeriod(),
                          ElectionPeriod.Evaluation
                        );
                      });

                      describe('when the election is evaluated', function () {
                        let rx: ethers.ContractReceipt;

                        before('evaluate', async function () {
                          rx = await (await c.CoreProxy.evaluate(0)).wait();
                        });

                        it('emits the event ElectionEvaluated', async function () {
                          await assertEvent(
                            rx,
                            `ElectionEvaluated(${epoch.index}, 3)`,
                            c.CoreProxy
                          );
                        });

                        it('shows that the election is evaluated', async function () {
                          assert.equal(await c.CoreProxy.isElectionEvaluated(), true);
                        });

                        it('shows each candidates votes', async function () {
                          const votesUser4 = (
                            await expectedVotePower(users[0]!, epoch.debtShareSnapshotId)
                          )
                            .add(await expectedVotePower(users[1]!, epoch.debtShareSnapshotId))
                            .add(await expectedVotePower(users[4]!, epoch.debtShareSnapshotId));
                          const votesUser5 = await expectedVotePower(
                            users[2]!,
                            epoch.debtShareSnapshotId
                          );
                          const votesUser6 = await expectedVotePower(
                            users[3]!,
                            epoch.debtShareSnapshotId
                          );

                          assertBn.equal(
                            await c.CoreProxy.getCandidateVotes(addresses[3]!),
                            votesUser4
                          );
                          assertBn.equal(
                            await c.CoreProxy.getCandidateVotes(addresses[4]!),
                            votesUser5
                          );
                          assertBn.equal(
                            await c.CoreProxy.getCandidateVotes(addresses[5]!),
                            votesUser6
                          );
                          assertBn.equal(await c.CoreProxy.getCandidateVotes(addresses[6]!), 0);
                          assertBn.equal(await c.CoreProxy.getCandidateVotes(addresses[7]!), 0);
                          assertBn.equal(await c.CoreProxy.getCandidateVotes(addresses[8]!), 0);
                        });

                        it('shows the election winners', async function () {
                          assert.deepEqual(await c.CoreProxy.getElectionWinners(), epoch.winners());
                        });

                        describe('when the election is resolved', function () {
                          before('resolve', async function () {
                            await (await c.CoreProxy.resolve()).wait();
                          });

                          it('shows the expected NFT owners', async function () {
                            const winners = epoch.winners();

                            assertBn.equal(
                              await c.CouncilToken.balanceOf(await owner.getAddress()),
                              winners.includes(await owner.getAddress()) ? 1 : 0
                            );
                            assertBn.equal(
                              await c.CouncilToken.balanceOf(addresses[3]!),
                              winners.includes(addresses[3]!) ? 1 : 0
                            );
                            assertBn.equal(
                              await c.CouncilToken.balanceOf(addresses[4]!),
                              winners.includes(addresses[4]!) ? 1 : 0
                            );
                            assertBn.equal(
                              await c.CouncilToken.balanceOf(addresses[5]!),
                              winners.includes(addresses[5]!) ? 1 : 0
                            );
                            assertBn.equal(
                              await c.CouncilToken.balanceOf(addresses[6]!),
                              winners.includes(addresses[6]!) ? 1 : 0
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
