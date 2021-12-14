const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/misc/mocha');
const initializer = require('../../helpers/initializer');

describe('RouterCoverage', () => {
  const { proxyAddress } = bootstrap(initializer);

  describe('when attempting to reach an unexistent function in Router', () => {
    let WrongModuleMock;

    before('identify modules', async () => {
      WrongModuleMock = await ethers.getContractAt('WrongModuleMock', proxyAddress());
    });

    it('reverts', async () => {
      await assertRevert(WrongModuleMock.getFortyTwo(), 'UnknownSelector(');
    });
  });

  describe('when reading from WrongModuleMock', () => {
    let WrongModuleMock;

    before('deploy the contract', async () => {
      const factory = await ethers.getContractFactory('WrongModuleMock');
      WrongModuleMock = await factory.deploy();
    });

    it('reads the right value', async () => {
      assertBn.eq(await WrongModuleMock.getFortyTwo(), 42);
    });
  });
});
