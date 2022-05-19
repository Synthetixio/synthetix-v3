const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');

module.exports = function(getElectionModule) {
  let ElectionModule;

  before('retrieve the election module', async function () {
    ElectionModule = await getElectionModule();
  });

  it('shows that the module is not initialized', async () => {
    assert.equal(await ElectionModule.isElectionModuleInitialized(), false);
  });

  it('shows that the council token does not exist', async function () {
    assert.equal(
      await ElectionModule.getCouncilToken(),
      '0x0000000000000000000000000000000000000000'
    );
  });

  describe('when trying to retrieve the period', function () {
    it('reverts', async function () {
      await assertRevert(ElectionModule.getCurrentPeriod(), 'NotInitialized');
    });
  });

  describe('when upgrading the council token', function () {
    it('reverts', async function () {
      await assertRevert(ElectionModule.upgradeCouncilToken('0x0000000000000000000000000000000000000001'), 'NotInitialized');
    });
  });
}
