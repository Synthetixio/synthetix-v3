const hre = require('hardhat');
const assert = require('assert');

const { ethers } = hre;

describe('OwnerModule', () => {
  let OwnerModuleMock, OwnerModuleMockFactory;

  before('load factory', async () => {
    OwnerModuleMockFactory = await ethers.getContractFactory('OwnerModuleMock');
  });

  beforeEach('initialize module', async () => {
    OwnerModuleMock = await OwnerModuleMockFactory.deploy();
  });

  describe('implementing custom storage', () => {
    it('correctly updates owner and nominated owner', async () => {
      const [, newOwner, newNominatedOwner] = await ethers.getSigners();
      await OwnerModuleMock.__setOwner(newOwner.address).then((tx) => tx.wait());
      assert(await OwnerModuleMock.__getOwner(), newOwner.address);

      await OwnerModuleMock.__setNominatedOwner(newNominatedOwner.address).then((tx) => tx.wait());
      assert(await OwnerModuleMock.__getNominatedOwner(), newNominatedOwner.address);
    });
  });
});
