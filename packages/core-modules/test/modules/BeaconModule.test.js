const hre = require('hardhat');
const assert = require('assert');

const { ethers } = hre;

describe('BeaconModule', () => {
  let BeackonModule, BeackonModuleFactory, DummyMockFactory;

  before('load factory', async () => {
    BeackonModuleFactory = await ethers.getContractFactory('BeaconModuleMock');
    DummyMockFactory = await ethers.getContractFactory('DummyMock');
  });

  beforeEach('deploy module', async () => {
    BeackonModule = await BeackonModuleFactory.deploy();
  });

  describe('when updating the implementation', () => {
    it('correctly updates the beacon storage', async () => {
      const NewImplementation = await DummyMockFactory.deploy();
      await BeackonModule.setImplementation(NewImplementation.address).then((tx) => tx.wait());
      assert.equal(await BeackonModule.getImplementation(), NewImplementation.address);
    });
  });
});
