const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');

describe('Beacon', () => {
  let Beacon, Implementation;

  let user;

  before('identify signers', async () => {
    [user] = await ethers.getSigners();
  });

  before('deploy the implementation', async () => {
    const factory = await ethers.getContractFactory('ImplementationMockA');
    Implementation = await factory.deploy();
  });

  before('when deploying a beacon with its first implementation', async () => {
    const factory = await ethers.getContractFactory('Beacon');
    Beacon = await factory.deploy(Implementation.address);
  });

  it('shows that the implementation is set', async () => {
    assert.equal(await Beacon.getImplementation(), Implementation.address);
  });

  describe('when trying to upgrade to an EOA', () => {
    it('reverts', async () => {
      await assertRevert(
        Beacon.setImplementation(user.address),
        `InvalidContract("${user.address}")`
      );
    });
  });

  describe('when trying to upgrade to the zero address', () => {
    it('reverts', async () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      await assertRevert(Beacon.setImplementation(zeroAddress), `InvalidAddress("${zeroAddress}")`);
    });
  });

  describe('when setting a new implementation', () => {
    before('deploy the new implementation', async () => {
      const factory = await ethers.getContractFactory('ImplementationMockB');
      Implementation = await factory.deploy();
    });

    before('set the new implementation', async () => {
      const tx = await Beacon.setImplementation(Implementation.address);
      await tx.wait();
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Beacon.getImplementation(), Implementation.address);
    });
  });
});
