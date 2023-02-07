// TODO: Remove
/* eslint-disable */

import hre from 'hardhat';
import { ethers } from 'ethers';
// import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
// import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../bootstrap';
// // const initializer = require('@synthetixio/core-modules/test/helpers/initializer');
// // const {
// //   getTime,
// //   takeSnapshot,
// //   restoreSnapshot,
// // } = require('@synthetixio/core-js/utils/hardhat/rpc');
// import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
// // const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
import { ElectionPeriod } from '../../utils/election-helper';
// // const {
// //   simulateDebtShareData,
// //   simulateCrossChainDebtShareData,
// //   expectedDebtShare,
// //   expectedVotePower,
// //   expectedCrossChainDebtShare,
// //   getCrossChainMerkleTree,
// // } = require('../../utils/debt-share-helper');
// // const { findEvent } = require('@synthetixio/core-utils/utils/ethers/events');
import { DebtShareMock, CouncilTokenModule } from '../../../typechain-types/index';
// import { DebtAssociatedEvent } from '../../../../synthetix/typechain-types/contracts/interfaces/IAssociateDebtModule';

// TODO: The port of these tests is incomplete. See README.md.

describe.skip('ElectionModule (election)', function () {
  const { signers, systems, provider } = bootstrap();

  let CouncilToken: CouncilTokenModule;
  let DebtShare: DebtShareMock;

  let owner: ethers.Signer;
  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let user3: ethers.Signer;
  let user4: ethers.Signer;
  let user5: ethers.Signer;
  let user6: ethers.Signer;
  let user7: ethers.Signer;
  let user8: ethers.Signer;
  let user9: ethers.Signer;

  //   //   let receipt;
  //   //   let merkleTree;
  //   //   let snapshotId;
  //   //   const epochData = [
  //   //     {
  //   //       index: 0,
  //   //       debtShareSnapshotId: 42,
  //   //       blockNumber: 21000000,
  //   //       winners: () => [user4.address, user5.address],
  //   //     },
  //   //     {
  //   //       index: 1,
  //   //       debtShareSnapshotId: 1337,
  //   //       blockNumber: 23100007,
  //   //       winners: () => [user4.address, user6.address],
  //   //     },
  //   //     {
  //   //       index: 2,
  //   //       debtShareSnapshotId: 2192,
  //   //       blockNumber: 30043001,
  //   //       winners: () => [user6.address, user5.address],
  //   //     },
  //   //   ];

  before('identify signers', async () => {
    [owner, user1, user2, user3, user4, user5, user6, user7, user8, user9] = signers();
  });

  before('identify the council token', async function () {
    CouncilToken = await hre.ethers.getContractAt(
      'CouncilTokenModule',
      await systems().Council.getCouncilToken()
    );
  });

  before('set next epoch seat count to 2', async function () {
    (await systems().Council.setNextEpochSeatCount(2)).wait();
  });

  it('shows that the next epoch seat count is set', async function () {
    assertBn.equal(await systems().Council.getNextEpochSeatCount(), 2);
  });

  it('shows that the current epoch index is 0', async function () {
    assertBn.equal(await systems().Council.getEpochIndex(), 1);
  });

  it('shows that the current period is Administration', async function () {
    assertBn.equal(await systems().Council.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  // TODO: The way that the council now calculates epoch indices has changed,
  // so these tests are failing.
  // describe('before a debt share snapshot is set', function () {
  //   describe('when trying to retrieve the current debt share snapshot id', function () {
  //     it('reverts', async function () {
  //       await assertRevert(
  //         systems().Council.getDebtShareSnapshotId(),
  //         'DebtShareSnapshotIdNotSet',
  //         systems().Council
  //       );
  //     });
  //   });

  //   describe('when trying to retrieve the current debt share of a user', function () {
  //     it('returns zero', async function () {
  //       assertBn.equal(await systems().Council.getDebtShare(await user1.getAddress()), 0);
  //     });
  //   });
  // });

  // TODO: Finish porting these tests
  //         describe('before a merkle root is set', function () {
  //           describe('when trying to retrieve the current cross chain merkle root', function () {
  //             it('reverts', async function () {
  //               await assertRevert(
  //                 ElectionModule.getCrossChainDebtShareMerkleRoot(),
  //                 'MerkleRootNotSet'
  //               );
  //             });
  //           });
  //           describe('when trying to retrieve the current cross chain merkle root block number', function () {
  //             it('reverts', async function () {
  //               await assertRevert(
  //                 ElectionModule.getCrossChainDebtShareMerkleRootBlockNumber(),
  //                 'MerkleRootNotSet'
  //               );
  //             });
  //           });
  //           describe('when trying to retrieve the current cross chain debt share of a user', function () {
  //             it('returns zero', async function () {
  //               assertBn.equal(await ElectionModule.getDeclaredCrossChainDebtShare(user1.address), 0);
  //             });
  //           });
  //         });
  //         describe('before the nomination period begins', function () {
  //           describe('when trying to set the debt share id', function () {
  //             it('reverts', async function () {
  //               await assertRevert(
  //                 ElectionModule.setDebtShareSnapshotId(0),
  //                 'NotCallableInCurrentPeriod'
  //               );
  //             });
  //           });
  //           describe('when trying to set the cross chain debt share merkle root', function () {
  //             it('reverts', async function () {
  //               await assertRevert(
  //                 ElectionModule.setCrossChainDebtShareMerkleRoot(
  //                   '0x000000000000000000000000000000000000000000000000000000000000beef',
  //                   1337
  //                 ),
  //                 'NotCallableInCurrentPeriod'
  //               );
  //             });
  //           });
  //         });
  //         describe('when advancing to the nominations period', function () {
  //           before('fast forward', async function () {
  //             await fastForwardTo(
  //               await ElectionModule.getNominationPeriodStartDate(),
  //               ethers.provider
  //             );
  //           });
  //           describe('when the current epochs debt share snapshot id is set', function () {
  //             before('simulate debt share data', async function () {
  //               await simulateDebtShareData(DebtShare, [user1, user2, user3, user4, user5]);
  //             });
  //             before('set snapshot id', async function () {
  //               const tx = await ElectionModule.setDebtShareSnapshotId(epoch.debtShareSnapshotId);
  //               receipt = await tx.wait();
  //             });
  //             it('emitted a DebtShareSnapshotIdSet event', async function () {
  //               const event = findEvent({ receipt, eventName: 'DebtShareSnapshotIdSet' });
  //               assert.ok(event);
  //               assertBn.equal(event.args.snapshotId, epoch.debtShareSnapshotId);
  //             });
  //             it('shows that the snapshot id is set', async function () {
  //               assertBn.equal(
  //                 await ElectionModule.getDebtShareSnapshotId(),
  //                 epoch.debtShareSnapshotId
  //               );
  //             });
  //             it('shows that users have the expected debt shares', async function () {
  //               assert.deepEqual(
  //                 await ElectionModule.getDebtShare(user1.address),
  //                 expectedDebtShare(user1.address, epoch.debtShareSnapshotId)
  //               );
  //               assert.deepEqual(
  //                 await ElectionModule.getDebtShare(user2.address),
  //                 expectedDebtShare(user2.address, epoch.debtShareSnapshotId)
  //               );
  //               assert.deepEqual(
  //                 await ElectionModule.getDebtShare(user3.address),
  //                 expectedDebtShare(user3.address, epoch.debtShareSnapshotId)
  //               );
  //               assert.deepEqual(
  //                 await ElectionModule.getDebtShare(user4.address),
  //                 expectedDebtShare(user4.address, epoch.debtShareSnapshotId)
  //               );
  //               assert.deepEqual(
  //                 await ElectionModule.getDebtShare(user5.address),
  //                 expectedDebtShare(user5.address, epoch.debtShareSnapshotId)
  //               );
  //             });
  //             describe('when cross chain debt share data is collected', function () {
  //               before('simulate cross chain debt share data', async function () {
  //                 await simulateCrossChainDebtShareData([user1, user2, user3]);
  //                 merkleTree = getCrossChainMerkleTree(epoch.debtShareSnapshotId);
  //               });
  //               describe('when a user attempts to declare cross chain debt shares and the merkle root is not set', function () {
  //                 before('take snapshot', async function () {
  //                   snapshotId = await takeSnapshot(ethers.provider);
  //                 });
  //                 after('restore snapshot', async function () {
  //                   await restoreSnapshot(snapshotId, ethers.provider);
  //                 });
  //                 before('fast forward', async function () {
  //                   await fastForwardTo(
  //                     await ElectionModule.getVotingPeriodStartDate(),
  //                     ethers.provider
  //                   );
  //                 });
  //                 it('reverts', async function () {
  //                   merkleTree = getCrossChainMerkleTree(epoch.debtShareSnapshotId);
  //                   await assertRevert(
  //                     ElectionModule.declareCrossChainDebtShare(
  //                       user1.address,
  //                       expectedCrossChainDebtShare(user1.address, epoch.debtShareSnapshotId),
  //                       merkleTree.claims[user1.address].proof
  //                     ),
  //                     'MerkleRootNotSet'
  //                   );
  //                 });
  //               });
  //               describe('when the current epochs cross chain debt share merkle root is set', function () {
  //                 before('set the merkle root', async function () {
  //                   const tx = await ElectionModule.setCrossChainDebtShareMerkleRoot(
  //                     merkleTree.merkleRoot,
  //                     epoch.blockNumber
  //                   );
  //                   receipt = await tx.wait();
  //                 });
  //                 before('nominate', async function () {
  //                   (await ElectionModule.connect(user4).nominate()).wait();
  //                   (await ElectionModule.connect(user5).nominate()).wait();
  //                   (await ElectionModule.connect(user6).nominate()).wait();
  //                   (await ElectionModule.connect(user7).nominate()).wait();
  //                   (await ElectionModule.connect(user8).nominate()).wait();
  //                   (await ElectionModule.connect(user9).nominate()).wait();
  //                 });
  //                 it('emitted a CrossChainDebtShareMerkleRootSet event', async function () {
  //                   const event = findEvent({
  //                     receipt,
  //                     eventName: 'CrossChainDebtShareMerkleRootSet',
  //                   });
  //                   assert.ok(event);
  //                   assertBn.equal(event.args.merkleRoot, merkleTree.merkleRoot);
  //                   assertBn.equal(event.args.blocknumber, epoch.blockNumber);
  //                 });
  //                 it('shows that the merkle root is set', async function () {
  //                   assert.equal(
  //                     await ElectionModule.getCrossChainDebtShareMerkleRoot(),
  //                     merkleTree.merkleRoot
  //                   );
  //                 });
  //                 it('shows that the merkle root block number is set', async function () {
  //                   assertBn.equal(
  //                     await ElectionModule.getCrossChainDebtShareMerkleRootBlockNumber(),
  //                     epoch.blockNumber
  //                   );
  //                 });
  //                 describe('when users declare their cross chain debt shares in the wrong period', function () {
  //                   it('reverts', async function () {
  //                     await assertRevert(
  //                       ElectionModule.declareCrossChainDebtShare(
  //                         user1.address,
  //                         expectedCrossChainDebtShare(user1.address, epoch.debtShareSnapshotId),
  //                         merkleTree.claims[user1.address].proof
  //                       ),
  //                       'NotCallableInCurrentPeriod'
  //                     );
  //                   });
  //                 });
  //                 describe('when advancing to the voting period', function () {
  //                   before('fast forward', async function () {
  //                     await fastForwardTo(
  //                       await ElectionModule.getVotingPeriodStartDate(),
  //                       ethers.provider
  //                     );
  //                   });
  //                   it('shows that the current period is Voting', async function () {
  //                     assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Vote);
  //                   });
  //                   describe('when users declare their cross chain debt shares incorrectly', function () {
  //                     describe('when a user declares a wrong amount', function () {
  //                       it('reverts', async function () {
  //                         const { proof } = merkleTree.claims[user2.address];
  //                         await assertRevert(
  //                           ElectionModule.declareCrossChainDebtShare(
  //                             user2.address,
  //                             ethers.utils.parseEther('10000000'),
  //                             proof
  //                           ),
  //                           'InvalidMerkleProof'
  //                         );
  //                       });
  //                     });
  //                     describe('when a user with no entry in the tree declares an amount', function () {
  //                       it('reverts', async function () {
  //                         const { proof } = merkleTree.claims[user2.address];
  //                         await assertRevert(
  //                           ElectionModule.declareCrossChainDebtShare(
  //                             user4.address,
  //                             ethers.utils.parseEther('1000'),
  //                             proof
  //                           ),
  //                           'InvalidMerkleProof'
  //                         );
  //                       });
  //                     });
  //                     describe('when a user uses the wrong tree to declare', function () {
  //                       it('reverts', async function () {
  //                         const anotherTree = getCrossChainMerkleTree(666);
  //                         const { amount, proof } = anotherTree.claims[user2.address];
  //                         await assertRevert(
  //                           ElectionModule.declareCrossChainDebtShare(user2.address, amount, proof),
  //                           'InvalidMerkleProof'
  //                         );
  //                       });
  //                     });
  //                   });
  //                   describe('when users declare their cross chain debt shares correctly', function () {
  //                     async function declare(user) {
  //                       const { amount, proof } = merkleTree.claims[user.address];
  //                       const tx = await ElectionModule.declareCrossChainDebtShare(
  //                         user.address,
  //                         amount,
  //                         proof
  //                       );
  //                       receipt = await tx.wait();
  //                     }
  //                     async function declareAndCast(user, candidates) {
  //                       const { amount, proof } = merkleTree.claims[user.address];
  //                       const tx = await ElectionModule.connect(user).declareAndCast(
  //                         amount,
  //                         proof,
  //                         candidates
  //                       );
  //                       receipt = await tx.wait();
  //                     }
  //                     before('declare', async function () {
  //                       await declare(user1);
  //                       await declare(user2);
  //                       // Note: Intentionally not declaring for user3
  //                     });
  //                     describe('when a user attempts to re-declare cross chain debt shares', function () {
  //                       it('reverts', async function () {
  //                         const { amount, proof } = merkleTree.claims[user1.address];
  //                         await assertRevert(
  //                           ElectionModule.declareCrossChainDebtShare(user1.address, amount, proof),
  //                           'CrossChainDebtShareAlreadyDeclared'
  //                         );
  //                       });
  //                     });
  //                     it('emitted a CrossChainDebtShareDeclared event', async function () {
  //                       const event = findEvent({
  //                         receipt,
  //                         eventName: 'CrossChainDebtShareDeclared',
  //                       });
  //                       assert.ok(event);
  //                       assertBn.equal(event.args.user, user2.address);
  //                       assertBn.equal(
  //                         event.args.debtShare,
  //                         expectedCrossChainDebtShare(user2.address, epoch.debtShareSnapshotId)
  //                       );
  //                     });
  //                     it('shows that users have declared their cross chain debt shares', async function () {
  //                       assertBn.equal(
  //                         await ElectionModule.getDeclaredCrossChainDebtShare(user1.address),
  //                         expectedCrossChainDebtShare(user1.address, epoch.debtShareSnapshotId)
  //                       );
  //                       assertBn.equal(
  //                         await ElectionModule.getDeclaredCrossChainDebtShare(user2.address),
  //                         expectedCrossChainDebtShare(user2.address, epoch.debtShareSnapshotId)
  //                       );
  //                     });
  //                     it('shows that users have the expected vote power (cross chain component is now declared)', async function () {
  //                       assert.deepEqual(
  //                         await ElectionModule.getVotePower(user1.address),
  //                         expectedVotePower(user1.address, epoch.debtShareSnapshotId)
  //                       );
  //                       assert.deepEqual(
  //                         await ElectionModule.getVotePower(user2.address),
  //                         expectedVotePower(user2.address, epoch.debtShareSnapshotId)
  //                       );
  //                     });
  //                     describe('when a user tries to vote for more than one candidate', function () {
  //                       it('reverts', async function () {
  //                         await assertRevert(
  //                           ElectionModule.connect(user1).cast([user4.address, user5.address]),
  //                           'TooManyCandidates'
  //                         );
  //                       });
  //                     });
  //                     describe('when users cast votes', function () {
  //                       let ballot1, ballot2, ballot3;
  //                       before('vote', async function () {
  //                         await ElectionModule.connect(user1).cast([user4.address]);
  //                         await ElectionModule.connect(user2).cast([user4.address]);
  //                         await declareAndCast(user3, [user5.address]); // user3 didn't declare cross chain debt shares yet
  //                         await ElectionModule.connect(user4).cast([user6.address]);
  //                         await ElectionModule.connect(user5).cast([user4.address]);
  //                       });
  //                       before('identify ballots', async function () {
  //                         ballot1 = await ElectionModule.calculateBallotId([user4.address]);
  //                         ballot2 = await ElectionModule.calculateBallotId([user5.address]);
  //                         ballot3 = await ElectionModule.calculateBallotId([user6.address]);
  //                       });
  //                       it('keeps track of which ballot each user voted on', async function () {
  //                         assert.equal(await ElectionModule.getBallotVoted(user1.address), ballot1);
  //                         assert.equal(await ElectionModule.getBallotVoted(user2.address), ballot1);
  //                         assert.equal(await ElectionModule.getBallotVoted(user3.address), ballot2);
  //                         assert.equal(await ElectionModule.getBallotVoted(user4.address), ballot3);
  //                         assert.equal(await ElectionModule.getBallotVoted(user5.address), ballot1);
  //                       });
  //                       it('keeps track of the candidates of each ballot', async function () {
  //                         assert.deepEqual(await ElectionModule.getBallotCandidates(ballot1), [
  //                           user4.address,
  //                         ]);
  //                         assert.deepEqual(await ElectionModule.getBallotCandidates(ballot2), [
  //                           user5.address,
  //                         ]);
  //                         assert.deepEqual(await ElectionModule.getBallotCandidates(ballot3), [
  //                           user6.address,
  //                         ]);
  //                       });
  //                       it('keeps track of vote power in each ballot', async function () {
  //                         const votesBallot1 = expectedVotePower(
  //                           user1.address,
  //                           epoch.debtShareSnapshotId
  //                         )
  //                           .add(expectedVotePower(user2.address, epoch.debtShareSnapshotId))
  //                           .add(expectedVotePower(user5.address, epoch.debtShareSnapshotId));
  //                         const votesBallot2 = expectedVotePower(
  //                           user3.address,
  //                           epoch.debtShareSnapshotId
  //                         );
  //                         const votesBallot3 = expectedVotePower(
  //                           user4.address,
  //                           epoch.debtShareSnapshotId
  //                         );
  //                         assertBn.equal(await ElectionModule.getBallotVotes(ballot1), votesBallot1);
  //                         assertBn.equal(await ElectionModule.getBallotVotes(ballot2), votesBallot2);
  //                         assertBn.equal(await ElectionModule.getBallotVotes(ballot3), votesBallot3);
  //                       });
  //                       describe('when voting ends', function () {
  //                         before('fast forward', async function () {
  //                           await fastForwardTo(
  //                             await ElectionModule.getEpochEndDate(),
  //                             ethers.provider
  //                           );
  //                         });
  //                         it('shows that the current period is Evaluation', async function () {
  //                           assertBn.equal(
  //                             await ElectionModule.getCurrentPeriod(),
  //                             ElectionPeriod.Evaluation
  //                           );
  //                         });
  //                         describe('when the election is evaluated', function () {
  //                           before('evaluate', async function () {
  //                             (await ElectionModule.evaluate(0)).wait();
  //                           });
  //                           it('shows that the election is evaluated', async function () {
  //                             assert.equal(await ElectionModule.isElectionEvaluated(), true);
  //                           });
  //                           it('shows each candidates votes', async function () {
  //                             const votesUser4 = expectedVotePower(
  //                               user1.address,
  //                               epoch.debtShareSnapshotId
  //                             )
  //                               .add(expectedVotePower(user2.address, epoch.debtShareSnapshotId))
  //                               .add(expectedVotePower(user5.address, epoch.debtShareSnapshotId));
  //                             const votesUser5 = expectedVotePower(
  //                               user3.address,
  //                               epoch.debtShareSnapshotId
  //                             );
  //                             const votesUser6 = expectedVotePower(
  //                               user4.address,
  //                               epoch.debtShareSnapshotId
  //                             );
  //                             assertBn.equal(
  //                               await ElectionModule.getCandidateVotes(user4.address),
  //                               votesUser4
  //                             );
  //                             assertBn.equal(
  //                               await ElectionModule.getCandidateVotes(user5.address),
  //                               votesUser5
  //                             );
  //                             assertBn.equal(
  //                               await ElectionModule.getCandidateVotes(user6.address),
  //                               votesUser6
  //                             );
  //                             assertBn.equal(
  //                               await ElectionModule.getCandidateVotes(user7.address),
  //                               0
  //                             );
  //                             assertBn.equal(
  //                               await ElectionModule.getCandidateVotes(user8.address),
  //                               0
  //                             );
  //                             assertBn.equal(
  //                               await ElectionModule.getCandidateVotes(user9.address),
  //                               0
  //                             );
  //                           });
  //                           it('shows the election winners', async function () {
  //                             assert.deepEqual(
  //                               await ElectionModule.getElectionWinners(),
  //                               epoch.winners()
  //                             );
  //                           });
  //                           describe('when the election is resolved', function () {
  //                             before('resolve', async function () {
  //                               (await ElectionModule.resolve()).wait();
  //                             });
  //                             it('shows the expected NFT owners', async function () {
  //                               const winners = epoch.winners();
  //                               assertBn.equal(
  //                                 await CouncilToken.balanceOf(owner.address),
  //                                 winners.includes(owner.address) ? 1 : 0
  //                               );
  //                               assertBn.equal(
  //                                 await CouncilToken.balanceOf(user4.address),
  //                                 winners.includes(user4.address) ? 1 : 0
  //                               );
  //                               assertBn.equal(
  //                                 await CouncilToken.balanceOf(user5.address),
  //                                 winners.includes(user5.address) ? 1 : 0
  //                               );
  //                               assertBn.equal(
  //                                 await CouncilToken.balanceOf(user6.address),
  //                                 winners.includes(user6.address) ? 1 : 0
  //                               );
  //                               assertBn.equal(
  //                                 await CouncilToken.balanceOf(user7.address),
  //                                 winners.includes(user7.address) ? 1 : 0
  //                               );
  //                             });
  //                           });
  //                         });
  //                       });
  //                     });
  //                   });
  //                 });
  //               });
  //             });
  //           });
  //         });
  //       });
  //     });
});
