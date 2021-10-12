const { ethers } = hre;
const assert = require('assert');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');

describe('ForwardingProxy', () => {
  let Proxy, Instance, Implementation;

  describe('when setting ImplementationMockA as the implementation', () => {
    before('set up proxy and implementation', async () => {
      let factory;

      factory = await ethers.getContractFactory('ImplementationMockA');
      Implementation = await factory.deploy();

      factory = await ethers.getContractFactory('ForwardingProxyMock');
      Proxy = await factory.deploy(Implementation.address);

      Instance = await ethers.getContractAt('ImplementationMockA', Proxy.address);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Proxy.getImplementation(), Implementation.address);
    });

    describe('when interacting with the implementation via the proxy', async () => {
      describe('when reading and setting a value that exists in the implementation', () => {
        before('set a value', async () => {
          await (await Instance.setA(42)).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await Instance.getA(), 42);
        });
      });

      describe('when trying to call a function that is not payable', () => {
        it('reverts', async () => {
          await assertRevert(
            Instance.setA(1337, { value: ethers.utils.parseEther('1') }),
            'non-payable method'
          );
        });
      });

      describe('when reading and setting a value that does not exist in the implementation', () => {
        let BadInstance;

        before('wrap the implementation', async () => {
          BadInstance = await ethers.getContractAt('ImplementationMockB', Proxy.address);
        });

        it('reverts', async () => {
          await assertRevert(BadInstance.getB(), 'function selector was not recognized');
        });
      });
    });
  });

  describe('when setting ImplementationMockB as the implementation', () => {
    before('set up proxy and implementation', async () => {
      let factory;

      factory = await ethers.getContractFactory('ImplementationMockB');
      Implementation = await factory.deploy();

      factory = await ethers.getContractFactory('ForwardingProxyMock');
      Proxy = await factory.deploy(Implementation.address);

      Instance = await ethers.getContractAt('ImplementationMockB', Proxy.address);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Proxy.getImplementation(), Implementation.address);
    });

    describe('when interacting with the implementation via the proxy', async () => {
      describe('when reading and setting a value that exists in the implementation, and sending ETH', () => {
        before('set a value and send ETH', async () => {
          await (await Instance.setA(1337, { value: ethers.utils.parseEther('1') })).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await Instance.getA(), 1337);
        });
      });

      describe('when reading and setting another value that exists in the implementation', () => {
        before('set a value and send ETH', async () => {
          await (await Instance.setB('Hello')).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await Instance.getB(), 'Hello');
        });
      });
    });
  });
});
