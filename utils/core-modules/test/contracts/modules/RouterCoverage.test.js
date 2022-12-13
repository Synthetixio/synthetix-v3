const { ethers } = hre;
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const { bootstrap } = require('../../helpers/bootstrap.js');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('RouterCoverage', () => {
  const { proxyAddress } = bootstrap(initializer, {
    modules: ['OwnerModule', 'UpgradeModule'],
  });

  let Router;

  before('identify modules', async function () {
    Router = await hre.ethers.getContractAt('Router', proxyAddress());
  });

  describe('when attempting to reach an unexistent function in Router', () => {
    let WrongModuleMock;

    before('identify modules', async () => {
      WrongModuleMock = await ethers.getContractAt('WrongModuleMock', proxyAddress());
    });

    it('reverts', async () => {
      await assertRevert(WrongModuleMock.getFortyTwo(), 'UnknownSelector(', Router);
    });
  });

  describe('when reading from WrongModuleMock', () => {
    let WrongModuleMock;

    before('deploy the contract', async () => {
      const factory = await ethers.getContractFactory('WrongModuleMock');
      WrongModuleMock = await factory.deploy();
    });

    it('reads the right value', async () => {
      assertBn.equal(await WrongModuleMock.getFortyTwo(), 42);
    });
  });
});
