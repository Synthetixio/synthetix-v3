const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const bootstrap = require('../../helpers/bootstrap');
const { ethers } = hre;

describe('ExtrasCoverage', () => {
  const { deploymentInfo } = bootstrap();

  describe('when attempting to reach an unexistent function in Router', () => {
    let WrongModuleMock;

    before('identify modules', async () => {
      const proxyAddress = getProxyAddress(deploymentInfo);

      WrongModuleMock = await ethers.getContractAt('WrongModuleMock', proxyAddress);
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
