const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getMainProxyAddress } = require('../../../utils/deployments');

describe('SettingsModule', () => {
  let SettingsModule;

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    const proxyAddress = getMainProxyAddress();

    SettingsModule = await ethers.getContractAt('SettingsModule', proxyAddress);
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
