const assert = require('assert/strict');
const { findEvent } = require('@synthetixio/core-utils/utils/ethers/events');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const bootstrap = require('../bootstrap');

describe('SomeModule', function () {
  const { getContract, getSigners } = bootstrap();

  let Proxy;
  let owner;

  let receipt;

  before('init', function () {
    [owner] = getSigners();
    Proxy = getContract('Proxy');
  });

  describe('when value is set', function () {
    before('set value', async function () {
      const tx = await Proxy.connect(owner).setValue(42);
      receipt = await tx.wait();
    });

    it('shows that the value was set', async function () {
      assertBn.equal(await Proxy.getValue(), 42);
    });

    it('emitted a ValueSet event', async function () {
      const event = findEvent({ receipt, eventName: 'ValueSet' });

      assert.equal(event.args.sender, await owner.getAddress());
      assertBn.equal(event.args.value, 42);
    });
  });

  describe('when someValue is set', function () {
    before('set some value', async function () {
      const tx = await Proxy.connect(owner).setSomeValue(1337);
      receipt = await tx.wait();
    });

    it('shows that the value was set', async function () {
      assertBn.equal(await Proxy.getSomeValue(), 1337);
    });

    it('emitted a ValueSet event', async function () {
      const event = findEvent({ receipt, eventName: 'ValueSet' });

      assert.equal(event.args.sender, await owner.getAddress());
      assertBn.equal(event.args.value, 1337);
    });
  });
});
