const { ethers } = hre;
const assert = require('assert/strict');

describe('StringUtil', () => {
  let StringUtil;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('StringUtilMock');
    StringUtil = await factory.deploy();
  });

  describe('uintToString(uint value)', () => {
    it('shows that it can stringify values', async () => {
      assert.equal(await StringUtil.uintToString(0), '0');
      assert.equal(await StringUtil.uintToString(1), '1');
      assert.equal(await StringUtil.uintToString(10), '10');
      assert.equal(await StringUtil.uintToString(1000), '1000');
      assert.equal(await StringUtil.uintToString(99999), '99999');
    });
  });
});
