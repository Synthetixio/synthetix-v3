const hre = require('hardhat');
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');

const { ethers } = hre;

describe('UpgradeModule', () => {
  let UpgradeModuleMockFactory, UpgradeModuleMock;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('initialize modules', async () => {
    UpgradeModuleMockFactory = await ethers.getContractFactory('UpgradeModuleMock');
    UpgradeModuleMock = await UpgradeModuleMockFactory.deploy();
  });

  before('set the owner', async () => {
    await UpgradeModuleMock.__setOwner(owner.address).then((tx) => tx.wait());
  });

  describe('when a regular user attempts to upgrade the system', () => {
    it('reverts', async () => {
      await assertRevert(
        UpgradeModuleMock.connect(user).upgradeTo(user.address),
        'OnlyOwnerAllowed'
      );
    });
  });

  describe('when the system is deployed', () => {
    it('upgrades the new implementation and returns the new result', async () => {
      try {
        await UpgradeModuleMock.connect(owner)
          .__setSimulatingUpgrade(true)
          .then((tx) => tx.wait());

        const NewUpgradeModule = await UpgradeModuleMockFactory.deploy();

        await UpgradeModuleMock.connect(owner)
          .upgradeTo(NewUpgradeModule.address)
          .then((tx) => tx.wait());

        assert.equal(await UpgradeModuleMock.getImplementation(), NewUpgradeModule.address);
      } finally {
        await UpgradeModuleMock.connect(owner)
          .__setSimulatingUpgrade(false)
          .then((tx) => tx.wait());
      }
    });
  });
});
