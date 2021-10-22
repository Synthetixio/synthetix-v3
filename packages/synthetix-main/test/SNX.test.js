const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const bootstrap = require('./helpers/bootstrap');

describe('SNXModule', function () {
  describe('When creating the SNX token', async () => {
    let owner, SNXModule, snxAddress;
    const { deploymentInfo, initSystem } = bootstrap();

    before('initialize the system', async () => {
      await initSystem();
      [owner] = await ethers.getSigners();
    });

    before('identify modules', async () => {
      const proxyAddress = getProxyAddress(deploymentInfo);
      SNXModule = await ethers.getContractAt('SNXModule', proxyAddress);
    });

    it('No SNX is deployed', async () => {
      const address = await SNXModule.getSNXAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the SNX is created', () => {
      let receipt;
      before('Create a SNX token', async () => {
        const tx = await SNXModule.connect(owner).createSNX();
        receipt = await tx.wait();
      });

      before('Identify newly created SNX', async () => {
        const event = findEvent({ receipt, eventName: 'SNXCreated' });
        snxAddress = event.args.snxAddress;
      });

      it('emmited an event', async () => {
        assert.notEqual(snxAddress, '0x0000000000000000000000000000000000000000');
      });

      it('gets the newly created address', async () => {
        const address = await SNXModule.getSNXAddress();
        assert.equal(address, snxAddress);
      });
    });
  });

  describe('When attempting to create the SNX twice', () => {
    let owner, SNXModule;
    const { deploymentInfo, initSystem } = bootstrap();

    before('initialize the system', async () => {
      await initSystem();
      [owner] = await ethers.getSigners();
    });

    before('identify modules', async () => {
      const proxyAddress = getProxyAddress(deploymentInfo);
      SNXModule = await ethers.getContractAt('SNXModule', proxyAddress);
    });

    it('No SNX is deployed', async () => {
      const address = await SNXModule.getSNXAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the SNX is created', () => {
      before('Create a SNX token', async () => {
        const tx = await SNXModule.connect(owner).createSNX();
        await tx.wait();
      });

      describe('When attempting to create the SNX again', () => {
        it('reverts', async () => {
          await assertRevert(SNXModule.connect(owner).createSNX(), 'SNXAlreadyCreated()');
        });
      });
    });
  });

  describe('When attempting to initialize the SNX more than one time', async () => {
    let owner, SNXModule, snxAddress;
    const { deploymentInfo, initSystem } = bootstrap();

    before('initialize the system', async () => {
      await initSystem();
      [owner] = await ethers.getSigners();
    });

    before('identify modules', async () => {
      const proxyAddress = getProxyAddress(deploymentInfo);
      SNXModule = await ethers.getContractAt('SNXModule', proxyAddress);
    });

    it('No SNX is deployed', async () => {
      const address = await SNXModule.getSNXAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the SNX is created', () => {
      let receipt;
      before('Create a SNX token', async () => {
        const tx = await SNXModule.connect(owner).createSNX();
        receipt = await tx.wait();
      });

      before('Identify newly created SNX', async () => {
        const event = findEvent({ receipt, eventName: 'SNXCreated' });
        snxAddress = event.args.snxAddress;
      });

      describe('When attempting to initialize the SNX again', () => {
        it('reverts', async () => {
          const SNX = await ethers.getContractAt('SNXImplementation', snxAddress);
          await assertRevert(SNX.initialize(owner.address), 'alreadyInitialized()');
        });
      });
    });
  });

  describe('When attempting to upgrade the SNXImplementation', () => {
    let owner, SNXModule, snxAddress;
    const { deploymentInfo, initSystem } = bootstrap();

    before('initialize the system', async () => {
      await initSystem();
      [owner] = await ethers.getSigners();
    });

    before('identify modules', async () => {
      const proxyAddress = getProxyAddress(deploymentInfo);
      SNXModule = await ethers.getContractAt('SNXModule', proxyAddress);
    });

    it('No SNX is deployed', async () => {
      const address = await SNXModule.getSNXAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the SNX is created', () => {
      let receipt;
      before('Create a SNX token', async () => {
        const tx = await SNXModule.connect(owner).createSNX();
        receipt = await tx.wait();
      });

      before('Identify newly created SNX', async () => {
        const event = findEvent({ receipt, eventName: 'SNXCreated' });
        snxAddress = event.args.snxAddress;
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let SNXUpdated, SNXImplementationUpdated;
        before('Deploy new implementation', async () => {
          const proxyAddress = getProxyAddress(deploymentInfo);

          const factory = await ethers.getContractFactory('SNXImplementationUpdated');
          SNXImplementationUpdated = await factory.deploy();
          await SNXImplementationUpdated.initialize(proxyAddress);
        });

        before('Upgrade to new implementation', async () => {
          const tx = await SNXModule.connect(owner).upgradeSNXImplementation(
            SNXImplementationUpdated.address
          );
          await tx.wait();

          SNXUpdated = await ethers.getContractAt('SNXImplementationUpdated', snxAddress);
        });
        it('is upgraded', async () => {
          const address = await SNXUpdated.getImplementation();
          assert.equal(address, SNXImplementationUpdated.address);
        });

        it('can interact with the new implementation', async () => {
          let valueA = await SNXUpdated.getValueA();
          assert.equal(valueA, 0);

          await SNXUpdated.setValueA(42);
          valueA = await SNXUpdated.getValueA();
          assert.equal(valueA, 42);
        });
      });
    });
  });
});
