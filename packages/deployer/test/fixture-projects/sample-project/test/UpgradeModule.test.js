const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const {
  getProxyAddress,
  getRouterAddress,
  getDeployment,
} = require('../../../../utils/deployments');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');
const { bootstrap, initializeSystem } = require('./helpers/initializer');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('UpgradeModule', () => {
  bootstrap();

  let UpgradeModule, OwnerModule;

  let owner, user;
  let proxyAddress, routerAddress;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('initialize the system', async () => {
    await initializeSystem({ owner });
  });

  before('identify modules', async () => {
    routerAddress = getRouterAddress();
    proxyAddress = getProxyAddress();

    UpgradeModule = await ethers.getContractAt('UpgradeModule', proxyAddress);
    OwnerModule = await ethers.getContractAt('OwnerModule', proxyAddress);
  });

  describe('when the system is deployed', () => {
    it('shows that the current implementation is correct', async () => {
      assert.equal(await UpgradeModule.getImplementation(), routerAddress);
    });
  });

  describe('when a regular user attempts to upgrade the system', () => {
    it('reverts', async () => {
      await assertRevert(
        UpgradeModule.connect(user).upgradeTo(user.address),
        'Only owner can invoke'
      );
    });
  });

  describe('when the owner attempts to upgrade to an EOA', () => {
    it('reverts', async () => {
      await assertRevert(
        UpgradeModule.connect(owner).upgradeTo(owner.address),
        'Implementation not a contract'
      );
    });
  });

  describe('when the owner attempts to upgrade to a sterile implementation', () => {
    it('reverts', async () => {
      const deployment = getDeployment();
      const someSterileContractAddress = deployment.contracts.SomeModule.deployedAddress;

      await assertRevert(
        UpgradeModule.connect(owner).upgradeTo(someSterileContractAddress),
        'Implementation is sterile'
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

  describe('when attempting to destroy the implementation with a malicious contract', () => {
    let destroyer;

    let OwnerModuleImpl, UpgradeModuleImpl;

    before('deploy the malicious contract', async () => {
      const factory = await ethers.getContractFactory('Destroyer');
      destroyer = await factory.deploy();
    });

    before('identify implementation modules', async () => {
      OwnerModuleImpl = await ethers.getContractAt('OwnerModule', routerAddress);
      UpgradeModuleImpl = await ethers.getContractAt('UpgradeModule', routerAddress);
    });

    it('shows that the owner of the implementation is address(0)', async () => {
      assert.equal(await OwnerModuleImpl.owner(), '0x0000000000000000000000000000000000000000');
    });

    it('shows that the implementation of the implementation is address(0)', async () => {
      assert.equal(
        await UpgradeModuleImpl.getImplementation(),
        '0x0000000000000000000000000000000000000000'
      );
    });

    describe('when owning the implementation', () => {
      before('own the implementation', async function () {
        let tx;

        tx = await OwnerModuleImpl.connect(user).nominateNewOwner(user.address);
        await tx.wait();

        tx = await OwnerModuleImpl.connect(user).acceptOwnership();
        await tx.wait();
      });

      it('shows that the user is now the owner of the implementation', async () => {
        assert.equal(await OwnerModuleImpl.owner(), user.address);
      });

      describe('when trying to upgrade the implementation of the implementation to the destroyer', () => {
        it('reverts', async () => {
          await assertRevert(
            UpgradeModuleImpl.connect(user).upgradeTo(destroyer.address),
            'Implementation is sterile'
          );
        });

        it('shows that the code of the implementation is not null', async () => {
          const code = await ethers.provider.getCode(routerAddress);

          assert.notEqual(code, '0x');
        });

        it('shows that the proxy is still responsive', async () => {
          assert.equal(await OwnerModule.owner(), owner.address);
        });
      });
    });
  });
});
