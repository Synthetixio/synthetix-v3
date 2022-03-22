const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../../spartan-council/test/helpers/initializer');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

const { ethers } = hre;

describe('ElectionModule (L1 debt share)', function () {
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
    const { proxyAddress } = bootstrap(initializer);

    let ElectionModule;

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

      await ElectionModule.initializeElectionModule(
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

    before('fast forward', async function () {
      await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
    });

    describe('when attempting to set the merkle root with a non owner signer', () => {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).setL1DebtShareMerkleRoot(validRoot, 1),
          'Unauthorized'
        );
      });
    });

    describe('when attempting to claim and the merkle root is not set', () => {
      it('reverts', async () => {
        await assertRevert(
          ElectionModule.declareL1DebtShare(
            voter,
            parsedTree.claims[voter].amount,
            parsedTree.claims[voter].proof
          ),
          'MerkleRootNotSet'
        );
      });
    });

    describe('when the merkle root is set', () => {
      let receipt;

      before('set merkle root', async () => {
        const tx = await ElectionModule.connect(owner).setL1DebtShareMerkleRoot(validRoot, 1);
        receipt = await tx.wait();
      });

      it('emitted a MerkleRootSet event', async function () {
        const event = findEvent({ receipt, eventName: 'L1DebtShareMerkleRootSet' });

        assert.ok(event);
        assert.deepEqual(event.args.merkleRoot, validRoot);
      });

      describe('when attempting to set the merkle root again', () => {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.connect(user).setL1DebtShareMerkleRoot(wrongTree.merkleRoot, 1),
            'Unauthorized'
          );
        });
      });

      describe('when attempting to claim with the wrong proof', () => {
        it('reverts', async () => {
          await assertRevert(
            ElectionModule.declareL1DebtShare(
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
          assertBn.equal(await ElectionModule.getL1DebtShare(voter), 0);
        });
      });

      describe('when a voter has declared their debt shares', () => {
        before('claim', async () => {
          const tx = await ElectionModule.declareL1DebtShare(
            voter,
            parsedTree.claims[voter].amount,
            parsedTree.claims[voter].proof
          );
          receipt = await tx.wait();
        });

        it('emitted a DebtShareDeclared event', async function () {
          const event = findEvent({ receipt, eventName: 'L1DebtShareDeclared' });

          assert.ok(event);
          assert.deepEqual(event.args.voter, voter);
          assertBn.equal(event.args.debtShare, parsedTree.claims[voter].amount);
        });

        it('has the right debt share', async () => {
          assertBn.equal(
            await ElectionModule.getL1DebtShare(voter),
            parsedTree.claims[voter].amount
          );
        });
      });
    });
  });
});
