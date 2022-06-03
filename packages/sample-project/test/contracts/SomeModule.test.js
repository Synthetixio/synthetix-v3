const { ethers } = hre;
const assert = require('assert/strict');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

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
      assertBn.equal(await SomeModule.getValue(), 42);
    });

    it('emitted a ValueSet event', async () => {
      const event = findEvent({ receipt, eventName: 'ValueSet' });

      assert.equal(event.args.sender, owner.address);
      assertBn.equal(event.args.value, 42);
    });
  });

  describe('when someValue is set', () => {
    before('set some value', async () => {
      const tx = await SomeModule.connect(owner).setSomeValue(1337);
      receipt = await tx.wait();
    });

    it('shows that the value was set', async () => {
      assertBn.equal(await SomeModule.getSomeValue(), 1337);
    });

    it('emitted a ValueSet event', async () => {
      const event = findEvent({ receipt, eventName: 'ValueSet' });

      assert.equal(event.args.sender, owner.address);
      assertBn.equal(event.args.value, 1337);
    });
  });
});
