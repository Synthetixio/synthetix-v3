const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('../../../utils/deployments');
const { bootstrap, initializeSystem } = require('./helpers/initializer');

describe('SomeModule', () => {
  bootstrap();

  let SomeModule;

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  before('initialize the system', async () => {
    await initializeSystem({ owner });
  });

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress();

    SomeModule = await ethers.getContractAt('SomeModule', proxyAddress);
  });

  describe('when the owner sets the value', () => {
    before('set value', async () => {
      const tx = await SomeModule.connect(owner).setValue(42);
      await tx.wait();
    });

    it('shows that the value was set', async () => {
      assert.equal(await SomeModule.getValue(), 42);
    });
  });

  describe('when the owner sets some value', () => {
    before('set some value', async () => {
      const tx = await SomeModule.connect(owner).setSomeValue(1337);
      await tx.wait();
    });

    it('shows that the value was set', async () => {
      assert.equal(await SomeModule.getSomeValue(), 1337);
    });
  });
});
