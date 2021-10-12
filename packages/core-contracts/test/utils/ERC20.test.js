const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
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
      await assertRevert(ERC20.connect(user1).burn(1), 'Burn amount exceeds balance');
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

    describe('transfer()', () => {
      const transferAmount = ethers.BigNumber.from('10');
      let currentSupply, user1Balance, user2Balance;

      before('record balances and supply', async () => {
        currentSupply = await ERC20.totalSupply();
        user1Balance = await ERC20.balanceOf(user1.address);
        user2Balance = await ERC20.balanceOf(user2.address);
      });

      describe('when not having enough balance', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC20.connect(user1).transfer(user2.address, user1Balance.add(1)),
            'Transfer amount exceeds balance'
          );
        });
      });

      describe('when having enough balance', () => {
        before('transfer', async () => {
          const tx = await ERC20.connect(user1).transfer(user2.address, transferAmount);
          receipt = await tx.wait();
        });

        it('does not alter the total supply', async () => {
          assert.equal(await ERC20.totalSupply(), currentSupply.toString());
        });

        it('reduces the sender balance and increases the receiver balance', async () => {
          assert.equal(
            await ERC20.balanceOf(user1.address),
            user1Balance.sub(transferAmount).toString()
          );
          assert.equal(
            await ERC20.balanceOf(user2.address),
            user2Balance.add(transferAmount).toString()
          );
        });

        it('emits a Transfer event', async () => {
          const event = findEvent({ receipt, eventName: 'Transfer' });

          assert.equal(event.args.from, user1.address);
          assert.equal(event.args.to, user2.address);
          assert.equal(event.args.amount, transferAmount.toString());
        });
      });
    });

    describe('Approve and TransferFrom', () => {
      const approvalAmount = ethers.BigNumber.from('10');
      let user1Balance, user2Balance;

      before('record balances', async () => {
        user1Balance = await ERC20.balanceOf(user1.address);
        user2Balance = await ERC20.balanceOf(user2.address);
      });

      before('approve', async () => {
        const tx = await ERC20.connect(user1).approve(user2.address, approvalAmount);
        receipt = await tx.wait();
      });

      it('sets the right allowance', async () => {
        assert.equal(
          await ERC20.allowance(user1.address, user2.address),
          approvalAmount.toString()
        );
      });

      it('emits an Approval event', async () => {
        const event = findEvent({ receipt, eventName: 'Approval' });

        assert.equal(event.args.owner, user1.address);
        assert.equal(event.args.spender, user2.address);
        assert.equal(event.args.amount, approvalAmount.toString());
      });

      describe('when trying to transfer more than the amount approved', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC20.connect(user2).transferFrom(user1.address, user2.address, approvalAmount.add(1)),
            'Amount exceeds allowance'
          );
        });
      });

      describe('when transfering less or equal than the approval amount', () => {
        const transferFromAmount = approvalAmount.sub(1);
        before('transferFrom to itself', async () => {
          let tx = await ERC20.connect(user2).transferFrom(
            user1.address,
            user2.address,
            transferFromAmount
          );
          receipt = await tx.wait();
          // get the new, reduced allowance
          const newAllowance = await ERC20.allowance(user1.address, user2.address);
          // transferFrom the remaining allowance
          tx = await ERC20.connect(user2).transferFrom(user1.address, user2.address, newAllowance);
          await tx.wait();
        });

        it('the allowance should be 0', async () => {
          assert.equal(await ERC20.allowance(user1.address, user2.address), '0');
        });

        it('updates the user balances accordingly', async () => {
          assert.equal(
            await ERC20.balanceOf(user1.address),
            user1Balance.sub(approvalAmount).toString()
          );
          assert.equal(
            await ERC20.balanceOf(user2.address),
            user2Balance.add(approvalAmount).toString()
          );
        });

        it('emits a Transfer event', async () => {
          const event = findEvent({ receipt, eventName: 'Transfer' });

          assert.equal(event.args.from, user1.address);
          assert.equal(event.args.to, user2.address);
          assert.equal(event.args.amount, transferFromAmount.toString());
        });
      });
    });
  });
});
