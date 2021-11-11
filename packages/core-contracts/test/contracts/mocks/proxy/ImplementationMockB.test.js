const { ethers } = hre;
const assert = require('assert');

describe('ImplementationMockB', () => {
  let ImplementationMockB;

  before('deploy the implementation', async () => {
    const factory = await ethers.getContractFactory('ImplementationMockB');
    ImplementationMockB = await factory.deploy();
  });

  describe('when interacting with ImplementationMockB', () => {
    before('set a value', async () => {});

    it('can read the value set on A', async () => {
      await (await ImplementationMockB.setA(42)).wait();
      assert.equal(await ImplementationMockB.getA(), 42);
    });

    it('can read the value set on B', async () => {
      await (await ImplementationMockB.setB('hello')).wait();
      assert.equal(await ImplementationMockB.getB(), 'hello');
    });
  });
});
