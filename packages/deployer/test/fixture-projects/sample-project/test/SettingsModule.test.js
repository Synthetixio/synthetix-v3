const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const bootstrap = require('./helpers/bootstrap');

describe('SettingsModule', () => {
  const { deploymentInfo, initSystem } = bootstrap();

  let SettingsModule;

  let owner, user;

  before('initialize the system', async () => {
    await initSystem();
  });

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress(deploymentInfo);

    SettingsModule = await ethers.getContractAt('SettingsModule', proxyAddress);
  });

  describe('when a regular user tries to set a value', () => {
    it('reverts', async () => {
      await assertRevert(SettingsModule.connect(user).setASettingValue(1), 'Only owner can invoke');
    });
  });

  describe('when the owner sets a value', () => {
    before('change a setting', async () => {
      const tx = await SettingsModule.connect(owner).setASettingValue(42);
      await tx.wait();
    });

    it('shows that the value was set', async () => {
      assert.equal(await SettingsModule.getASettingValue(), 42);
    });
  });
});
