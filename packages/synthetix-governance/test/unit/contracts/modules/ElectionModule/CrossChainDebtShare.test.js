const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../helpers/initializer');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

const { ethers } = hre;

describe('SynthetixElectionModule (cross chain debt share)', function () {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let owner, user, DebtShare;

  let parsedTree, validRoot, wrongTree, voter;

  before('build tree and related data', () => {
    const inputData = {};
    const wrongData = {};

    for (let i = 0; i < 10; i++) {
      const address = ethers.Wallet.createRandom().address;
      inputData[address] = '' + (i + 1);
      wrongData[address] = '' + (i + 2);
    }

    parsedTree = parseBalanceMap(inputData);
    wrongTree = parseBalanceMap(wrongData);

    validRoot = parsedTree.merkleRoot;

    voter = Object.keys(parsedTree.claims)[0];
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
          ElectionModule.connect(owner).setCrossChainDebtShareMerkleRoot(validRoot, 1),
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
            ElectionModule.connect(user).setCrossChainDebtShareMerkleRoot(validRoot, 1),
            'Unauthorized'
          );
        });
      });

      describe('when the merkle root is set', () => {
        let receipt;

        before('set merkle root', async () => {
          const tx = await ElectionModule.connect(owner).setCrossChainDebtShareMerkleRoot(
            validRoot,
            41
          );

          receipt = await tx.wait();
        });

        it('emitted a MerkleRootSet event', async function () {
          const event = findEvent({ receipt, eventName: 'CrossChainDebtShareMerkleRootSet' });

          assert.ok(event);
          assert.deepEqual(event.args.merkleRoot, validRoot);
          assertBn.equal(event.args.blocknumber, 41);
          assertBn.equal(event.args.epoch, 0);
        });

        it('gets the merkle root blocknumber', async function () {
          assertBn.equal(await ElectionModule.getCrossChainDebtShareMerkleRootBlocknumber(), 41);
        });

        it('gets the merkle root', async function () {
          assert.deepEqual(await ElectionModule.getCrossChainDebtShareMerkleRoot(), validRoot);
        });

        describe('when merkle root is set again', function () {
          before('set merkle root', async () => {
            const tx = await ElectionModule.connect(owner).setCrossChainDebtShareMerkleRoot(
              validRoot,
              42
            );

            receipt = await tx.wait();
          });

          it('emitted a MerkleRootSet event', async function () {
            const event = findEvent({ receipt, eventName: 'CrossChainDebtShareMerkleRootSet' });

            assert.ok(event);
            assert.deepEqual(event.args.merkleRoot, validRoot);
            assertBn.equal(event.args.blocknumber, 42);
            assertBn.equal(event.args.epoch, 0);
          });

          it('gets the merkle root blocknumber', async function () {
            assertBn.equal(await ElectionModule.getCrossChainDebtShareMerkleRootBlocknumber(), 42);
          });

          it('gets the merkle root', async function () {
            assert.deepEqual(await ElectionModule.getCrossChainDebtShareMerkleRoot(), validRoot);
          });

          describe('when declaring cross chain debt shares', function () {
            describe('in the nomination period', function () {
              it('reverts', async function () {
                await assertRevert(
                  ElectionModule.declareCrossChainDebtShare(
                    voter,
                    parsedTree.claims[voter].amount,
                    parsedTree.claims[voter].proof
                  ),
                  'NotCallableInCurrentPeriod'
                );
              });
            });

            describe('in the voting period', function () {
              before('fast forward', async function () {
                await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
              });

              describe('with the wrong proof', () => {
                it('reverts', async () => {
                  await assertRevert(
                    ElectionModule.declareCrossChainDebtShare(
                      voter,
                      wrongTree.claims[voter].amount,
                      wrongTree.claims[voter].proof
                    ),
                    'InvalidMerkleProof'
                  );
                });
              });

              describe('when retrieving the voter declared debt before declaring it', () => {
                it('has 0 debt share', async () => {
                  assertBn.equal(await ElectionModule.getDeclaredCrossChainDebtShare(voter), 0);
                });
              });

              describe('with the right proof', () => {
                before('declare', async () => {
                  const tx = await ElectionModule.declareCrossChainDebtShare(
                    voter,
                    parsedTree.claims[voter].amount,
                    parsedTree.claims[voter].proof
                  );
                  receipt = await tx.wait();
                });

                it('emitted a DebtShareDeclared event', async function () {
                  const event = findEvent({ receipt, eventName: 'CrossChainDebtShareDeclared' });

                  assert.ok(event);
                  assert.deepEqual(event.args.user, voter);
                  assertBn.equal(event.args.debtShare, parsedTree.claims[voter].amount);
                });

                it('has the right debt share', async () => {
                  assertBn.equal(
                    await ElectionModule.getDeclaredCrossChainDebtShare(voter),
                    parsedTree.claims[voter].amount
                  );
                });

                describe('when a voter attempts to declare their cross chain debt shares again', function () {
                  it('reverts', async function () {
                    await assertRevert(
                      ElectionModule.declareCrossChainDebtShare(
                        voter,
                        parsedTree.claims[voter].amount,
                        parsedTree.claims[voter].proof
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
