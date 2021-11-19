const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { findEvent } = require('@synthetixio/core-js/utils/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('./helpers/initializer');

describe('SomeModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let SomeModule;

  let owner;

  let receipt;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    SomeModule = await ethers.getContractAt('SomeModule', proxyAddress());
  });

  describe('when value is set', () => {
    before('set value', async () => {
      const tx = await SomeModule.connect(owner).setValue(42);
      receipt = await tx.wait();
    });

    it('shows that the value was set', async () => {
      assert.equal(await SomeModule.getValue(), 42);
    });

    it('emitted a ValueSet event', async () => {
      const event = findEvent({ receipt, eventName: 'ValueSet' });

      assert.equal(event.args.sender, owner.address);
      assert.equal(event.args.value, 42);
    });
  });

  describe('when someValue is set', () => {
    before('set some value', async () => {
      const tx = await SomeModule.connect(owner).setSomeValue(1337);
      receipt = await tx.wait();
    });

    it('shows that the value was set', async () => {
      assert.equal(await SomeModule.getSomeValue(), 1337);
    });

    it('emitted a ValueSet event', async () => {
      const event = findEvent({ receipt, eventName: 'ValueSet' });

      assert.equal(event.args.sender, owner.address);
      assert.equal(event.args.value, 1337);
    });
  });
});
