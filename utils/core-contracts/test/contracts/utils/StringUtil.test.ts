import assert from 'node:assert/strict';
import hre from 'hardhat';
import { StringUtilMock } from '../../../typechain-types';

describe('StringUtil', function () {
  let StringUtil: StringUtilMock;

  before('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('StringUtilMock');
    StringUtil = await factory.deploy();
  });

  describe('uintToString(uint value)', function () {
    it('shows that it can stringify values', async function () {
      assert.equal(await StringUtil.uintToString(0), '0');
      assert.equal(await StringUtil.uintToString(1), '1');
      assert.equal(await StringUtil.uintToString(10), '10');
      assert.equal(await StringUtil.uintToString(1000), '1000');
      assert.equal(await StringUtil.uintToString(99999), '99999');
    });
  });
});
