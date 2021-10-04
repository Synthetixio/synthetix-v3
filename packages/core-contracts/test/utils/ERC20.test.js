const { ethers } = hre;
const assert = require('assert');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');
const { findEvent } = require('@synthetixio/core-js/utils/events');

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

    it('reverts when trying to burn', async () => {
      await assertRevert(
        ERC20.burn(1),
        'Arithmetic operation underflowed or overflowed outside of an unchecked block'
      );
    });
  });

  describe('when tokens are minted', () => {
    const totalSupply = ethers.BigNumber.from('1000000');
    let receipt;

    before('mint', async () => {
      const tx = await ERC20.connect(user1).mint(totalSupply);
      receipt = await tx.wait();
    });

    it('updates the total supply', async () => {
      assert.equal(await ERC20.totalSupply(), totalSupply.toString());
    });

    it('mints the right amount to the user', async () => {
      assert.equal(await ERC20.balanceOf(user1.address), totalSupply.toString());
    });

    it('emits a Transfer event', async () => {
      const event = findEvent({ receipt, eventName: 'Transfer' });

      assert.equal(event.args.from, '0x0000000000000000000000000000000000000000');
      assert.equal(event.args.to, user1.address);
      assert.equal(event.args.amount, totalSupply.toString());
    });

    describe('when tokens are burned', () => {
      const tokensToBurn = ethers.BigNumber.from('1000');
      const newSupply = totalSupply.sub(tokensToBurn);

      before('burn', async () => {
        const tx = await ERC20.connect(user1).burn(tokensToBurn);
        receipt = await tx.wait();
      });

      it('updates the total supply', async () => {
        assert.equal(await ERC20.totalSupply(), newSupply.toString());
      });

      it('reduces the user balance', async () => {
        assert.equal(await ERC20.balanceOf(user1.address), newSupply.toString());
      });

      it('emits a Transfer event', async () => {
        const event = findEvent({ receipt, eventName: 'Transfer' });

        assert.equal(event.args.from, user1.address);
        assert.equal(event.args.to, '0x0000000000000000000000000000000000000000');
        assert.equal(event.args.amount, tokensToBurn.toString());
      });
    });
  });
});
