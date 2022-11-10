const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const bootstrap = require('../bootstrap');

describe('SettingsModule', () => {
  const { getContract, getSigners } = bootstrap();

  let owner, user;
  let SettingsModule;

  before('init', function () {
    [owner, user] = getSigners();
    SettingsModule = getContract('SettingsModule');
  });

  describe('when a regular user tries to set a value', function () {
    it('reverts', async function () {
      await assertRevert(SettingsModule.connect(user).setASettingValue(1), 'Unauthorized');
    });
  });

  describe('when the owner sets a value', () => {
    before('change a setting', async function () {
      const tx = await SettingsModule.connect(owner).setASettingValue(42);
      await tx.wait();
    });

    it('shows that the value was set', async function () {
      assertBn.equal(await SettingsModule.getASettingValue(), 42);
    });
  });
});
