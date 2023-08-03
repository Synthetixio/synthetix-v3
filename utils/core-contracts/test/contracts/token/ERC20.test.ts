import assert from 'node:assert/strict';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { ERC20Mock } from '../../../typechain-types';

describe('ERC20', function () {
  let ERC20: ERC20Mock;

  let user1: ethers.Signer;
  let user2: ethers.Signer;

  before('identify signers', async function () {
    [user1, user2] = await hre.ethers.getSigners();
  });

  before('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('ERC20Mock');
    ERC20 = await factory.deploy();
    const tx = await ERC20.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
  });

  describe('When attempting to initialize it again', () => {
    it('with new decimal reverts', async () => {
      await assertRevert(
        ERC20.initialize('Synthetix Network Token Updated', 'snx', 19),
        'AlreadyInitialized()'
      );
    });
  });

  describe('when specifying zero addresses or amounts', function () {
    it('reverts', async function () {
      await assertRevert(
        ERC20.approve(ethers.constants.AddressZero, 1),
        'InvalidParameter("target", "Zero address")'
      );
      await assertRevert(
        ERC20.transfer(ethers.constants.AddressZero, 1),
        'InvalidParameter("target", "Zero address")'
      );
      await assertRevert(
        ERC20.mintFor(ethers.constants.AddressZero, 1),
        'InvalidParameter("target", "Zero address")'
      );
      await assertRevert(
        ERC20.burnFor(ethers.constants.AddressZero, 1),
        'InvalidParameter("target", "Zero address")'
      );

      // Zero amount
      await assertRevert(
        ERC20.transfer(await user1.getAddress(), 0),
        'InvalidParameter("amount", "Zero amount")'
      );
      await assertRevert(ERC20.mint(0), 'InvalidParameter("amount", "Zero amount")');
      await assertRevert(ERC20.burn(0), 'InvalidParameter("amount", "Zero amount")');
    });
  });

  describe('Before minting any tokens', function () {
    it('the total supply is 0', async function () {
      assertBn.equal(await ERC20.totalSupply(), 0);
    });

    it('the constructor arguments are set correctly', async function () {
      assert.equal(await ERC20.name(), 'Synthetix Network Token');
      assert.equal(await ERC20.symbol(), 'snx');
      assertBn.equal(await ERC20.decimals(), 18);
    });

    it('reverts when trying to burn', async function () {
      await assertRevert(ERC20.connect(user1).burn(1), 'InsufficientBalance("1", "0")');
    });
  });

  describe('when tokens are minted', function () {
    const totalSupply = BigNumber.from('1000000');
    let receipt: TransactionReceipt;

    before('mint', async function () {
      const tx = await ERC20.connect(user1).mint(totalSupply);
      receipt = await tx.wait();
    });

    it('updates the total supply', async function () {
      assertBn.equal(await ERC20.totalSupply(), totalSupply);
    });

    it('mints the right amount to the user', async function () {
      assertBn.equal(await ERC20.balanceOf(await user1.getAddress()), totalSupply);
    });

    it('emits a Transfer event', async function () {
      const evt = findEvent({ receipt, eventName: 'Transfer' });

      assert(!Array.isArray(evt) && evt?.args);
      assert.equal(evt.args.from, '0x0000000000000000000000000000000000000000');
      assert.equal(evt.args.to, await user1.getAddress());
      assertBn.equal(evt.args.amount, totalSupply);
    });

    describe('when tokens are burned', function () {
      const tokensToBurn = BigNumber.from('1000');
      const newSupply = totalSupply.sub(tokensToBurn);

      before('burn', async function () {
        const tx = await ERC20.connect(user1).burn(tokensToBurn);
        receipt = await tx.wait();
      });

      it('updates the total supply', async function () {
        assertBn.equal(await ERC20.totalSupply(), newSupply);
      });

      it('reduces the user balance', async function () {
        assertBn.equal(await ERC20.balanceOf(await user1.getAddress()), newSupply);
      });

      it('emits a Transfer event', async function () {
        const evt = findEvent({ receipt, eventName: 'Transfer' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.from, await user1.getAddress());
        assert.equal(evt.args.to, '0x0000000000000000000000000000000000000000');
        assertBn.equal(evt.args.amount, tokensToBurn);
      });
    });

    describe('transfer()', function () {
      const transferAmount = BigNumber.from('10');
      let currentSupply: BigNumber;
      let user1Balance: BigNumber;
      let user2Balance: BigNumber;

      before('record balances and supply', async function () {
        currentSupply = await ERC20.totalSupply();
        user1Balance = await ERC20.balanceOf(await user1.getAddress());
        user2Balance = await ERC20.balanceOf(await user2.getAddress());
      });

      describe('when not having enough balance', function () {
        it('reverts ', async function () {
          const amount = user1Balance.add(1);

          await assertRevert(
            ERC20.connect(user1).transfer(await user2.getAddress(), amount),
            `InsufficientBalance("${amount.toString()}", "${user1Balance.toString()}")`
          );
        });
      });

      describe('when having enough balance', function () {
        before('transfer', async function () {
          const tx = await ERC20.connect(user1).transfer(await user2.getAddress(), transferAmount);
          receipt = await tx.wait();
        });

        it('does not alter the total supply', async function () {
          assertBn.equal(await ERC20.totalSupply(), currentSupply);
        });

        it('reduces the sender balance and increases the receiver balance', async function () {
          assertBn.equal(
            await ERC20.balanceOf(await user1.getAddress()),
            user1Balance.sub(transferAmount)
          );
          assertBn.equal(
            await ERC20.balanceOf(await user2.getAddress()),
            user2Balance.add(transferAmount)
          );
        });

        it('emits a Transfer event', async function () {
          const evt = findEvent({ receipt, eventName: 'Transfer' });

          assert(!Array.isArray(evt) && evt?.args);
          assert.equal(evt.args.from, await user1.getAddress());
          assert.equal(evt.args.to, await user2.getAddress());
          assertBn.equal(evt.args.amount, transferAmount);
        });
      });
    });

    describe('Approve and TransferFrom', function () {
      const approvalAmount = BigNumber.from('10');
      let user1Balance: BigNumber;
      let user2Balance: BigNumber;

      before('record balances', async function () {
        user1Balance = await ERC20.balanceOf(await user1.getAddress());
        user2Balance = await ERC20.balanceOf(await user2.getAddress());
      });

      before('approve', async function () {
        const tx = await ERC20.connect(user1).approve(await user2.getAddress(), approvalAmount);
        receipt = await tx.wait();
      });

      it('sets the right allowance', async function () {
        assertBn.equal(
          await ERC20.allowance(await user1.getAddress(), await user2.getAddress()),
          approvalAmount
        );
      });

      it('emits an Approval event', async function () {
        const evt = findEvent({ receipt, eventName: 'Approval' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.owner, await user1.getAddress());
        assert.equal(evt.args.spender, await user2.getAddress());
        assertBn.equal(evt.args.amount, approvalAmount);
      });

      describe('approve()', async function () {
        it('revokes token when amount zero', async function () {
          await ERC20.connect(user1).approve(await user2.getAddress(), BigNumber.from('0'));
          assertBn.equal(
            await ERC20.allowance(await user1.getAddress(), await user2.getAddress()),
            '0'
          );
        });

        after('reset approval', async () => {
          await ERC20.connect(user1).approve(await user2.getAddress(), approvalAmount);
        });
      });

      describe('increaseAllowance()', async () => {
        it('reverts when overflowing', async () => {
          await assertRevert(
            ERC20.connect(user1).increaseAllowance(
              await user2.getAddress(),
              ethers.constants.MaxUint256
            ),
            'overflow',
            ERC20
          );
        });

        describe('successful invocation', async () => {
          before('invoke', async () => {
            receipt = await (
              await ERC20.connect(user1).increaseAllowance(await user2.getAddress(), approvalAmount)
            ).wait();
          });

          it('increases allowance', async () => {
            assertBn.equal(
              await ERC20.allowance(await user1.getAddress(), await user2.getAddress()),
              approvalAmount.mul(2)
            );
          });

          it('emits event', async () => {
            const evt = findEvent({ receipt, eventName: 'Approval' });

            assert(!Array.isArray(evt) && evt?.args);
            assert.equal(evt.args.owner, await user1.getAddress());
            assert.equal(evt.args.spender, await user2.getAddress());
            assertBn.equal(evt.args.amount, approvalAmount.mul(2));
          });
        });

        after('reset approval', async () => {
          await ERC20.connect(user1).approve(await user2.getAddress(), approvalAmount);
        });
      });

      describe('decreaseAllowance()', async () => {
        it('reverts when underflowing', async () => {
          await assertRevert(
            ERC20.connect(user1).decreaseAllowance(await user2.getAddress(), approvalAmount.add(1)),
            'overflow',
            ERC20
          );
        });

        describe('successful invocation', async () => {
          before('invoke', async () => {
            receipt = await (
              await ERC20.connect(user1).decreaseAllowance(
                await user2.getAddress(),
                approvalAmount.sub(1)
              )
            ).wait();
          });

          it('decreases allowance', async () => {
            assertBn.equal(
              await ERC20.allowance(await user1.getAddress(), await user2.getAddress()),
              1
            );
          });

          it('emits event', async () => {
            const evt = findEvent({ receipt, eventName: 'Approval' });

            assert(!Array.isArray(evt) && evt?.args);
            assert.equal(evt.args.owner, await user1.getAddress());
            assert.equal(evt.args.spender, await user2.getAddress());
            assertBn.equal(evt.args.amount, 1);
          });
        });

        after('reset approval', async () => {
          await ERC20.connect(user1).approve(await user2.getAddress(), approvalAmount);
        });
      });

      describe('when trying to transfer more than the amount approved', function () {
        it('reverts ', async function () {
          const amount = approvalAmount.add(1);

          await assertRevert(
            ERC20.connect(user2).transferFrom(
              await user1.getAddress(),
              await user2.getAddress(),
              amount
            ),
            `InsufficientAllowance("${amount.toString()}", "${approvalAmount.toString()}")`
          );
        });
      });

      describe('when transferring less or equal than the approval amount', function () {
        const transferFromAmount = approvalAmount.sub(1);

        before('transferFrom to itself', async function () {
          let tx = await ERC20.connect(user2).transferFrom(
            await user1.getAddress(),
            await user2.getAddress(),
            transferFromAmount
          );
          receipt = await tx.wait();
          // get the new, reduced allowance
          const newAllowance = await ERC20.allowance(
            await user1.getAddress(),
            await user2.getAddress()
          );
          // transferFrom the remaining allowance
          tx = await ERC20.connect(user2).transferFrom(
            await user1.getAddress(),
            await user2.getAddress(),
            newAllowance
          );
          await tx.wait();
        });

        it('the allowance should be 0', async function () {
          assertBn.equal(
            await ERC20.allowance(await user1.getAddress(), await user2.getAddress()),
            '0'
          );
        });

        it('updates the user balances accordingly', async function () {
          assertBn.equal(
            await ERC20.balanceOf(await user1.getAddress()),
            user1Balance.sub(approvalAmount)
          );
          assertBn.equal(
            await ERC20.balanceOf(await user2.getAddress()),
            user2Balance.add(approvalAmount)
          );
        });

        it('emits a Transfer event', async function () {
          const evt = findEvent({ receipt, eventName: 'Transfer' });

          assert(!Array.isArray(evt) && evt?.args);
          assert.equal(evt.args.from, await user1.getAddress());
          assert.equal(evt.args.to, await user2.getAddress());
          assertBn.equal(evt.args.amount, transferFromAmount);
        });
      });
    });
  });
});
