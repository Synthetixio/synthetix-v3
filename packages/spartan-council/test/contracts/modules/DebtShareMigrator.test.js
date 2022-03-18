const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

const { ethers } = hre;

describe('DebtShareMigrator', function () {
  let parsedTree, validRoot, invalidRoot;

  before('build tree and roots', () => {
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
  });

  describe('when setting a merkle root', () => {
    const { proxyAddress, routerAddress } = bootstrap(initializer);

    let ElectionModule;

    before('identify module', async () => {
      ElectionModule = await ethers.getContractAt(
        'contracts/modules/ElectionModule.sol:ElectionModule',
        proxyAddress()
      );
    });

    describe('when attempting to set the merkle root with a non owner signer', () => {
      it('reverts', async function () {
        const [, user] = await ethers.getSigners();

        await assertRevert(ElectionModule.connect(user).setNewRoot(validRoot), 'Unauthorized');
      });
    });

    describe('when the merkle root is set', () => {
      let owner, user;

      before('identify users', async () => {
        [owner, user] = await ethers.getSigners();
      });

      before('set merkle root', async () => {
        const tx = await ElectionModule.connect(owner).setNewRoot(validRoot);
        await tx.wait();
      });

      it('sss', async () => {
        assert.ok(true);
        // assert.equal(await UpgradeModule.getImplementation(), routerAddress());

        // const tx = await UpgradeModule.upgradeTo(NewRouter.address);
        // await tx.wait();

        // assert.equal(await UpgradeModule.getImplementation(), NewRouter.address);
      });
    });
  });
});
