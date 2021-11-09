const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const bootstrap = require('../../helpers/bootstrap');

describe('SNXTokenModule', function () {
  const { deploymentInfo, initSystem } = bootstrap();

  let owner;

  before('initialize the system', async () => {
    await initSystem();
    [owner] = await ethers.getSigners();
  });

  describe('When creating the SNX token', async () => {
    let SNXTokenModule, snxTokenAddress;
    before('identify modules', async () => {
      const proxyAddress = getProxyAddress(deploymentInfo);
      SNXTokenModule = await ethers.getContractAt('SNXTokenModule', proxyAddress);
    });

    it('No SNX is deployed', async () => {
      const address = await SNXTokenModule.getSNXTokenAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the SNX is created', () => {
      let receipt;
      before('Create a SNX token', async () => {
        const tx = await SNXTokenModule.connect(owner).createSNX();
        receipt = await tx.wait();
      });

      before('Identify newly created SNX', async () => {
        const event = findEvent({ receipt, eventName: 'SNXTokenCreated' });
        snxTokenAddress = event.args.snxAddress;
      });

      it('emmited an event', async () => {
        assert.notEqual(snxTokenAddress, '0x0000000000000000000000000000000000000000');
      });

      it('gets the newly created address', async () => {
        const address = await SNXTokenModule.getSNXTokenAddress();
        assert.equal(address, snxTokenAddress);
      });

      describe('When attempting to create the SNX twice', () => {
        it('reverts', async () => {
          await assertRevert(SNXTokenModule.connect(owner).createSNX(), 'SNXAlreadyCreated()');
        });
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let AnotherSNXToken;

        before('Deploy new implementation', async () => {
          const factory = await ethers.getContractFactory('SNXToken');
          AnotherSNXToken = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await SNXTokenModule.connect(owner).upgradeSNXImplementation(
            AnotherSNXToken.address
          );
          await tx.wait();
        });

        it('is upgraded', async () => {
          const SNXToken = await ethers.getContractAt('SNXToken', snxTokenAddress);
          assert.equal(AnotherSNXToken.address, await SNXToken.getImplementation());
        });
      });
    });
  });
});
