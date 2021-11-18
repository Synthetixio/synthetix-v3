const hre = require('hardhat');
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');

const { ethers } = hre;

describe('CoreOwnerModule', () => {
  bootstrap(() => {});

  let OwnerModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('deploy the module, mocking the first owner', async () => {
    const factory = await ethers.getContractFactory('OwnerModuleMock');
    OwnerModule = await factory.deploy(owner.address);
  });

  it('shows that the owner is set', async () => {
    assert.equal(await OwnerModule.owner(), owner.address);
  });

  describe('when a regular user attempts to interact with the protected function', () => {
    it('reverts', async () => {
      await assertRevert(OwnerModule.connect(user).protectedFn(42), 'OnlyOwnerAllowed()');
    });
  });

  describe('when the owner interacts with the protected function', () => {
    before('set value', async () => {
      await (await OwnerModule.connect(owner).protectedFn(42)).wait();
    });

    it('sets the value', async () => {
      assert.equal((await OwnerModule.value()).toNumber(), 42);
    });
  });
});
