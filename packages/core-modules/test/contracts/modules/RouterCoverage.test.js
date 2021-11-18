const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { ethers } = hre;

describe('ExtrasCoverage', () => {
  const { proxyAddress } = bootstrap(() => {});

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

    it('reads the right valie', async () => {
      assert.equal(await WrongModuleMock.getFortyTwo(), 42);
    });
  });
});
