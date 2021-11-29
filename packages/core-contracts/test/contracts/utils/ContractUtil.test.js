const { ethers } = hre;
const assert = require('assert/strict');

describe('ContractHelper', () => {
  let ContractUtil;

  let user;

  before('identify signers', async () => {
    [user] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ContractUtilMock');
    ContractUtil = await factory.deploy();
  });

  describe('_isContract(address account)', () => {
    it('shows that an EOA is not a contract', async () => {
      assert.equal(await ContractUtil.isContract(user.address), false);
    });

    it('shows that itself is a contract', async () => {
      assert.equal(await ContractUtil.isContract(ContractUtil.address), true);
    });
  });

  describe('_toString(uint256 value)', () => {
    it('shows that it can stringify values', async () => {
      assert.equal(await ContractUtil.stringify(0), '0');
      assert.equal(await ContractUtil.stringify(1), '1');
      assert.equal(await ContractUtil.stringify(10), '10');
      assert.equal(await ContractUtil.stringify(1000), '1000');
      assert.equal(await ContractUtil.stringify(99999), '99999');
    });
  });
});
