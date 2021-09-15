const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress, getRouterAddress, getDeployment } = require('../../../utils/deployments');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');
const { bootstrap, initializeSystem } = require('./helpers/initializer');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('UpgradeModule', () => {
  bootstrap();

  let UpgradeModule;

  let owner, user;
  let routerAddress;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('initialize the system', async () => {
    await initializeSystem({ owner });
  });

  before('identify modules', async () => {
    routerAddress = getRouterAddress();
    const proxyAddress = getProxyAddress();

    UpgradeModule = await ethers.getContractAt('UpgradeModule', proxyAddress);
  });

  describe('when the system is deployed', () => {
    it('shows that the current implementation is correct', async () => {
      assert.equal(await UpgradeModule.getImplementation(), routerAddress);
    });
  });

  describe('when a regular user attempts to upgrade the system', () => {
    it('reverts', async () => {
      await assertRevert(UpgradeModule.connect(user).upgradeTo(user.address), 'Only owner allowed');
    });
  });

  describe('when the owner attempts to upgrade to an EOA', () => {
    it('reverts', async () => {
      await assertRevert(
        UpgradeModule.connect(owner).upgradeTo(owner.address),
        'Invalid: not a contract'
      );
    });
  });

  describe('when the owner attempts to upgrade to a sterile implementation', () => {
    it('reverts', async () => {
      const deployment = getDeployment();
      const someSterileContractAddress = deployment.contracts.SomeModule.deployedAddress;

      await assertRevert(
        UpgradeModule.connect(owner).upgradeTo(someSterileContractAddress),
        'brick upgrade'
      );
    });
  });

  describe('when the owner upgrades to a non-sterile implementation', () => {
    let receipt;

    before('upgrade', async () => {
      const tx = await UpgradeModule.connect(owner).upgradeTo(routerAddress);
      receipt = await tx.wait();
    });

    it('emitted an Upgraded event', async () => {
      const event = findEvent({ receipt, eventName: 'Upgraded' });

      assert.equal(event.args.implementation, routerAddress);
    });

    it('shows that the current implementation is correct', async () => {
      assert.equal(await UpgradeModule.getImplementation(), routerAddress);
    });
  });
});
