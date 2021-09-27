const { ethers } = hre;
// const assert = require('assert');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');

describe('UniversalProxy', () => {
  let UniversalProxy;

  let user;

  before('identify signers', async () => {
    [user] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('UniversalProxy');
    UniversalProxy = await factory.deploy();
  });

  describe('when attempting to upgrade to an implementation with the zero address', () => {
    it('reverts', async () => {
      await assertRevert(
        UniversalProxy.upgradeTo('0x0000000000000000000000000000000000000000'),
        'Implementation is zero address'
      );
    });
  });

  describe('when attempting to upgrade to an implementation that is not a contract', () => {
    it('reverts', async () => {
      await assertRevert(UniversalProxy.upgradeTo(user.address), 'Implementation not a contract');
    });
  });
});
