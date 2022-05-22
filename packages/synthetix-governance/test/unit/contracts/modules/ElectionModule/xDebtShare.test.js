const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../helpers/initializer');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { buildCrossChainDebtShareMerkleTree } = require('./helpers/debt-share-helper');

describe('SynthetixElectionModule (cross chain debt share)', function () {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let owner, user, DebtShare;

  let goodTree, badTree
  let goodVoter, badVoter;

  before('build valid tree', () => {
    goodTree = buildCrossChainDebtShareMerkleTree(
      ethers.utils.parseEther('10000')
    );

    goodVoter = Object.keys(goodTree.claims)[0];
  });

  before('build invalid tree', async function () {
    badTree = buildCrossChainDebtShareMerkleTree(
      ethers.utils.parseEther('100000')
    );

    badVoter = Object.keys(badTree.claims)[0];
  });

  before('identify users', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('deploy debt shares mock', async function () {
    const factory = await ethers.getContractFactory('DebtShareMock');
    DebtShare = await factory.deploy();
  });

  describe('when setting a merkle root', () => {
    before('identify module', async () => {
      ElectionModule = await ethers.getContractAt(
        'contracts/modules/ElectionModule.sol:ElectionModule',
        proxyAddress()
      );
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
        [owner.address],
        1,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate,
        DebtShare.address
      );
    });

    describe('when attempting to set the merkle before time, in the Administration period', () => {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(owner).setCrossChainDebtShareMerkleRoot(goodTree.merkleRoot, 1),
          'NotCallableInCurrentPeriod'
        );
      });
    });

    describe('when moving to nomination period', () => {
      before('fast forward', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      describe('when attempting to set the merkle root with a non owner signer', () => {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.connect(user).setCrossChainDebtShareMerkleRoot(goodTree.merkleRoot, 1),
            'Unauthorized'
          );
        });
      });

      describe('when the merkle root is set', () => {
        let receipt;

        before('set merkle root', async () => {
          const tx = await ElectionModule.connect(owner).setCrossChainDebtShareMerkleRoot(
            goodTree.merkleRoot,
            41
          );

          receipt = await tx.wait();
        });

        it('emitted a MerkleRootSet event', async function () {
          const event = findEvent({ receipt, eventName: 'CrossChainDebtShareMerkleRootSet' });

          assert.ok(event);
          assert.deepEqual(event.args.merkleRoot, goodTree.merkleRoot);
          assertBn.equal(event.args.blocknumber, 41);
          assertBn.equal(event.args.epoch, 0);
        });

        it('gets the merkle root blocknumber', async function () {
          assertBn.equal(await ElectionModule.getCrossChainDebtShareMerkleRootBlocknumber(), 41);
        });

        it('gets the merkle root', async function () {
          assert.deepEqual(await ElectionModule.getCrossChainDebtShareMerkleRoot(), goodTree.merkleRoot);
        });

        describe('when merkle root is set again', function () {
          before('set merkle root', async () => {
            const tx = await ElectionModule.connect(owner).setCrossChainDebtShareMerkleRoot(
              goodTree.merkleRoot,
              42
            );

            receipt = await tx.wait();
          });

          it('emitted a MerkleRootSet event', async function () {
            const event = findEvent({ receipt, eventName: 'CrossChainDebtShareMerkleRootSet' });

            assert.ok(event);
            assert.deepEqual(event.args.merkleRoot, goodTree.merkleRoot);
            assertBn.equal(event.args.blocknumber, 42);
            assertBn.equal(event.args.epoch, 0);
          });

          it('gets the merkle root blocknumber', async function () {
            assertBn.equal(await ElectionModule.getCrossChainDebtShareMerkleRootBlocknumber(), 42);
          });

          it('gets the merkle root', async function () {
            assert.deepEqual(await ElectionModule.getCrossChainDebtShareMerkleRoot(), goodTree.merkleRoot);
          });

          describe('when declaring cross chain debt shares', function () {
            describe('in the nomination period', function () {
              it('reverts', async function () {
                await assertRevert(
                  ElectionModule.declareCrossChainDebtShare(
                    goodVoter,
                    goodTree.claims[goodVoter].amount,
                    goodTree.claims[goodVoter].proof
                  ),
                  'NotCallableInCurrentPeriod'
                );
              });
            });

            describe('in the voting period', function () {
              before('fast forward', async function () {
                await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
              });

              describe('with the wrong amount', () => {
                it('reverts', async () => {
                  await assertRevert(
                    ElectionModule.declareCrossChainDebtShare(
                      goodVoter,
                      ethers.utils.parseEther('200000'),
                      goodTree.claims[goodVoter].proof
                    ),
                    'InvalidMerkleProof'
                  );
                });
              });

              describe('with the wrong proof', () => {
                it('reverts', async () => {
                  await assertRevert(
                    ElectionModule.declareCrossChainDebtShare(
                      badVoter,
                      badTree.claims[badVoter].amount,
                      badTree.claims[badVoter].proof
                    ),
                    'InvalidMerkleProof'
                  );
                });
              });

              describe('when retrieving the goodVoter declared debt before declaring it', () => {
                it('has 0 debt share', async () => {
                  assertBn.equal(await ElectionModule.getDeclaredCrossChainDebtShare(goodVoter), 0);
                });
              });

              describe('with the right proof', () => {
                before('declare', async () => {
                  const tx = await ElectionModule.declareCrossChainDebtShare(
                    goodVoter,
                    goodTree.claims[goodVoter].amount,
                    goodTree.claims[goodVoter].proof
                  );
                  receipt = await tx.wait();
                });

                it('emitted a DebtShareDeclared event', async function () {
                  const event = findEvent({ receipt, eventName: 'CrossChainDebtShareDeclared' });

                  assert.ok(event);
                  assert.deepEqual(event.args.user, goodVoter);
                  assertBn.equal(event.args.debtShare, goodTree.claims[goodVoter].amount);
                });

                it('has the right debt share', async () => {
                  assertBn.equal(
                    await ElectionModule.getDeclaredCrossChainDebtShare(goodVoter),
                    goodTree.claims[goodVoter].amount
                  );
                });

                describe('when a goodVoter attempts to declare their cross chain debt shares again', function () {
                  it('reverts', async function () {
                    await assertRevert(
                      ElectionModule.declareCrossChainDebtShare(
                        goodVoter,
                        goodTree.claims[goodVoter].amount,
                        goodTree.claims[goodVoter].proof
                      ),
                      'CrossChainDebtShareAlreadyDeclared'
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
