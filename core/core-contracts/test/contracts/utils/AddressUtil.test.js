const { ethers } = hre;
const assert = require('assert/strict');

describe('AddressUtil', () => {
  let AddressUtil;

  let user;

  before('identify signers', async () => {
    [user] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('AddressUtilMock');
    AddressUtil = await factory.deploy();
  });

  describe('isContract(address account)', () => {
    it('shows that an EOA is not a contract', async () => {
      assert.equal(await AddressUtil.isContract(user.address), false);
    });

    it('shows that itself is a contract', async () => {
      assert.equal(await AddressUtil.isContract(AddressUtil.address), true);
    });
  });
});
