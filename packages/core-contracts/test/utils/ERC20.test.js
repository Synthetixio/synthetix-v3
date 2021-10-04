const { ethers } = hre;
const assert = require('assert');

describe('ERC20', () => {
  let ERC20;

  let user1, user2;

  before('identify signers', async () => {
    [user1, user2] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ERC20Mock');
    ERC20 = await factory.deploy('Synthetix Network Token', 'snx', 18);
  });

  describe('Before minting any tokens', () => {
    it('the total supply is 0', async () => {
      assert.equal(await ERC20.totalSupply(), 0);
    });

    it('the constructor arguments are set correctly', async () => {
      assert.equal(await ERC20.name(), 'Synthetix Network Token');
      assert.equal(await ERC20.symbol(), 'snx');
      assert.equal(await ERC20.decimals(), 18);
    });
  });

  describe('mint tokens', () => {
    const totalSupply = '1000000';

    before('mint', async () => {
      const tx = await ERC20.connect(user1).mint(totalSupply);
      await tx.wait();
    });

    it('updates the total supply', async () => {
      assert.equal(await ERC20.totalSupply(), totalSupply);
    });

    it('mints the right amount to the user', async () => {
      assert.equal(await ERC20.balanceOf(user1.address), totalSupply);
    });
  });
});
