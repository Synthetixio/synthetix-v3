const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const bootstrap = require('../bootstrap');

describe('SettingsModule', () => {
  const { getContract, getSigners } = bootstrap();

  let owner, user;
  let Proxy;

  before('init', function () {
    [owner, user] = getSigners();
    Proxy = getContract('Proxy');
  });

  describe('when a regular user tries to set a value', function () {
    it('reverts', async function () {
      await assertRevert(
        Proxy.connect(user).setASettingValue(1),
        `Unauthorized("${await user.getAddress()}")`
      );
    });
  });

  describe('when the owner sets a value', () => {
    before('change a setting', async function () {
      const tx = await Proxy.connect(owner).setASettingValue(42);
      await tx.wait();
    });

    it('shows that the value was set', async function () {
      assertBn.equal(await Proxy.getASettingValue(), 42);
    });
  });
});
