const hre = require('hardhat');
const assert = require('assert');

const { ethers } = hre;

describe('BaseProxy', () => {
  let BaseProxyMock, BaseProxyMockFactory, DummyMockFactory;

  before('load factory', async () => {
    [BaseProxyMockFactory, DummyMockFactory] = await Promise.all([
      ethers.getContractFactory('BaseProxyMock'),
      ethers.getContractFactory('DummyMock'),
    ]);
  });

  beforeEach('initialize module', async () => {
    BaseProxyMock = await BaseProxyMockFactory.deploy('0x0000000000000000000000000000000000000000');
  });

  describe('when updating the implementation', () => {
    it('correctly updates the proxy storage', async () => {
      const NewImplementation = await DummyMockFactory.deploy();
      await BaseProxyMock.__setImplementation(NewImplementation.address).then((tx) => tx.wait());
      assert.equal(await BaseProxyMock.__getImplementation(), NewImplementation.address);
    });
  });
});
