const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('../../../utils/deployments');
const { printGasUsed } = require('@synthetixio/core-js/utils/tests');
const { bootstrap, initializeSystem } = require('./helpers/initializer');

describe('AnotherModule', () => {
  bootstrap();

  let SomeModule, AnotherModule;

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
    AnotherModule = await ethers.getContractAt('AnotherModule', proxyAddress);
  });

  describe('when setting a value in SomeModule via AnotherModule', () => {
    before('set value if zero for correct gas measurements', async () => {
      await (await SomeModule.setSomeValue(1)).wait();
    });

    it('using casting', async function () {
      const tx = await AnotherModule.connect(owner).setSomeValueCast(42);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(await SomeModule.getSomeValue(), 42);
    });

    it('using the router', async function () {
      const tx = await AnotherModule.connect(owner).setSomeValueRouter(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(await SomeModule.getSomeValue(), 1337);
    });
  });
});
