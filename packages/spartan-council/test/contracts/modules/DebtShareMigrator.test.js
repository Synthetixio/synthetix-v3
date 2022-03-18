// const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

const { ethers } = hre;

describe('DebtShareMigrator', function () {
  let owner, user;

  let parsedTree, validRoot, invalidRoot, voter;

  before('build tree and related data', () => {
    const inputData = {};
    const wrongData = {};
    for (let i = 0; i < 10; i++) {
      inputData[ethers.Wallet.createRandom().address] = '' + (i + 1);
    }

    parsedTree = parseBalanceMap(inputData);

    validRoot = parsedTree.merkleRoot;

    for (let i = 0; i < 5; i++) {
      wrongData[ethers.Wallet.createRandom().address] = '' + (i + 1);
    }

    invalidRoot = parseBalanceMap(wrongData).merkleRoot;

    voter = Object.keys(parsedTree.claims)[0];
  });

  before('identify users', async () => {
    [owner, user] = await ethers.getSigners();
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

    describe('when attempting to set the merkle root with a non owner signer', () => {
      it('reverts', async function () {
        await assertRevert(ElectionModule.connect(user).setNewRoot(validRoot), 'Unauthorized');
      });
    });

    describe('when attempting to claim and the merkle root is not set', () => {
      it('reverts', async () => {
        await assertRevert(
          ElectionModule.migrateL1DebtShare(
            voter,
            parsedTree.claims[voter].amount,
            parsedTree.claims[voter].proof
          ),
          'MerkleRootNotSet'
        );
      });
    });

    describe('when the merkle root is set', () => {
      before('set merkle root', async () => {
        const tx = await ElectionModule.connect(owner).setNewRoot(validRoot);
        await tx.wait();
      });

      describe('when attempting to set the merkle root again', () => {
        it('reverts', async function () {
          await assertRevert(ElectionModule.connect(user).setNewRoot(invalidRoot), 'Unauthorized');
        });
      });

      describe('shows that the voter migrated debt before claiming', () => {
        it('has 0 debt share', async () => {
          assertBn.equal(await ElectionModule.getL1DebtShare(voter), 0);
        });
      });
    });
  });
});
