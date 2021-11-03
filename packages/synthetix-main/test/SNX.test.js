const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const bootstrap = require('./helpers/bootstrap');

describe('SNXTokenModule', function () {
  const { deploymentInfo, initSystem } = bootstrap();

  let owner;

  before('initialize the system', async () => {
    await initSystem();
    [owner] = await ethers.getSigners();
  });

  describe('When creating the SNX token', async () => {
    let SNXTokenModule, snxAddress;
    before('identify modules', async () => {
      const proxyAddress = getProxyAddress(deploymentInfo);
      SNXTokenModule = await ethers.getContractAt('SNXTokenModule', proxyAddress);
    });

    it('No SNX is deployed', async () => {
      const address = await SNXTokenModule.getSNXAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the SNX is created', () => {
      let receipt;
      before('Create a SNX token', async () => {
        const tx = await SNXTokenModule.connect(owner).createSNXProxy('Synthetix Token', 'SNX', 18);
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
        const address = await SNXTokenModule.getSNXAddress();
        assert.equal(address, snxAddress);
      });

      it('can interact with the ERC20 implementation', async () => {
        let symbol = await SNXUpdated.symbol();
        assert.equal(symbol, 'SNX');

        let name = await SNXUpdated.name();
        assert.equal(name, 'Synthetix Token');

        let decimals = await SNXUpdated.decimals();
        assert.equal(decimals, 18);
      });

      describe('When attempting to create the SNX twice', () => {
        it('reverts', async () => {
          await assertRevert(SNXTokenModule.connect(owner).createSNXProxy(), 'SNXAlreadyCreated()');
        });
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let SNXUpdated, SNXImplementationUpdated;
        before('Deploy new implementation', async () => {
          const proxyAddress = getProxyAddress(deploymentInfo);

          const factory = await ethers.getContractFactory('SNXImplementation');
          SNXImplementationUpdated = await factory.deploy('Synthetix Token Updated', 'uSNX', 18);
        });

        before('Upgrade to new implementation', async () => {
          const tx = await SNXTokenModule.connect(owner).setSNXImplementation(
            SNXImplementationUpdated.address
          );
          await tx.wait();

          SNXUpdated = await ethers.getContractAt('SNXImplementation', snxAddress);
        });
        it('is upgraded', async () => {
          const address = await SNXUpdated.getImplementation();
          assert.equal(address, SNXImplementationUpdated.address);
        });

        it('can interact with the new implementation', async () => {
          let symbol = await SNXUpdated.symbol();
          assert.equal(symbol, 'uSNX');

          let name = await SNXUpdated.name();
          assert.equal(name, 'Synthetix Token Updated');

          let decimals = await SNXUpdated.decimals();
          assert.equal(decimals, 18);
        });
      });
    });
  });
});
