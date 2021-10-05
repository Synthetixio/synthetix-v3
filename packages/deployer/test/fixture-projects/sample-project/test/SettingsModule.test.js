const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('../../../../utils/deployments');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');
const { bootstrap, initializeSystem } = require('./helpers/initializer');

describe('SettingsModule', () => {
  bootstrap();

  let SettingsModule;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('initialize the system', async () => {
    await initializeSystem({ owner });
  });

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress();

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
