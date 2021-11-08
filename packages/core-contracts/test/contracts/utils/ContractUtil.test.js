const { ethers } = hre;
const assert = require('assert');

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
});
