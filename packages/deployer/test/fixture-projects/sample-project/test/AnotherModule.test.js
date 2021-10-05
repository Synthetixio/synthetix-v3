const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('../../../../utils/deployments');
const { printGasUsed } = require('@synthetixio/core-js/utils/tests');
const { bootstrap, initializeSystem } = require('./helpers/initializer');
const { findEvent } = require('@synthetixio/core-js/utils/events');

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

  describe('when writting to GlobalNamespace.someValue', () => {
    before('set value if zero for correct gas measurements', async () => {
      await (await SomeModule.setSomeValue(1)).wait();
    });

    it('directly via SomeModule', async function () {
      const tx = await SomeModule.connect(owner).setSomeValue(42);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(await SomeModule.getSomeValue(), 42);

      const event = findEvent({ receipt, eventName: 'ValueSet' });
      assert.equal(event.args.sender, owner.address);
      assert.equal(event.args.value, 42);
    });

    it('indirectly via AnotherModule', async function () {
      const tx = await AnotherModule.connect(owner).setSomeValueOnSomeModule(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(await SomeModule.getSomeValue(), 1337);

      const event = findEvent({ receipt, eventName: 'ValueSet', contract: SomeModule });
      assert.equal(event.args.sender, owner.address);
      assert.equal(event.args.value, 1337);
    });
  });
});
