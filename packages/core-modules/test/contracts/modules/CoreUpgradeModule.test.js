const hre = require('hardhat');
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');

const { ethers } = hre;

describe('CoreUpgradeModule', () => {
  bootstrap(() => {});

  let UpgradeModule, Implementation;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('deploy the implementation', async () => {
    const factory = await ethers.getContractFactory('ImplementationMock');
    Implementation = await factory.deploy();
  });

  before('deploy the module mocking the first owner', async () => {
    const factory = await ethers.getContractFactory('CoreUpgradeModuleMock');
    UpgradeModule = await factory.deploy();

    const tx = await UpgradeModule.mockFirstOwner(owner.address);
    await tx.wait();
  });

  it('shows that the implementation is not set', async () => {
    assert.equal(
      await UpgradeModule.getImplementation(),
      '0x0000000000000000000000000000000000000000'
    );
  });

  describe('when attempting to set the implementation with a non owner signer', () => {
    it('reverts', async () => {
      await assertRevert(UpgradeModule.connect(user).upgradeTo(user.address), 'OnlyOwnerAllowed()');
    });
  });

  // TODO: Anti-implementation destruction protection does not allow
  // this unit test to work anymore, which makes sense.
  // This can be unskipped once we use integration tests in core-modules.
  describe.skip('when setting the first implementation', () => {
    before('set the first implentation using the owner address', async () => {
      const tx = await UpgradeModule.connect(owner).upgradeTo(Implementation.address);
      await tx.wait();
    });

    it('shows that the implementation is not set', async () => {
      assert.equal(await UpgradeModule.getImplementation(), Implementation.address);
    });
  });
});
