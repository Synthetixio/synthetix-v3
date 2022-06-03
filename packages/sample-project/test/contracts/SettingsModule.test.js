const { ethers } = hre;
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('SettingsModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let SettingsModule;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    SettingsModule = await ethers.getContractAt('SettingsModule', proxyAddress());
  });

  describe('when a regular user tries to set a value', () => {
    it('reverts', async () => {
      await assertRevert(SettingsModule.connect(user).setASettingValue(1), 'Unauthorized');
    });
  });

  describe('when the owner sets a value', () => {
    before('change a setting', async () => {
      const tx = await SettingsModule.connect(owner).setASettingValue(42);
      await tx.wait();
    });

    it('shows that the value was set', async () => {
      assertBn.equal(await SettingsModule.getASettingValue(), 42);
    });
  });
});
