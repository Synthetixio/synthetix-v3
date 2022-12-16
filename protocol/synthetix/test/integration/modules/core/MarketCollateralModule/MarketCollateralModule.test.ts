import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ethers } from 'ethers';
import { bootstrapWithMockMarketAndPool } from '../../../bootstrap';

describe('MarketCollateralModule', function () {
  const { signers, systems, MockMarket, marketId, collateralAddress, collateralContract, restore } =
    bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer;

  describe('MarketCollateralModule', function () {
    before('identify signers', async () => {
      [owner, user1] = signers();

      // The owner assigns a maximum of 1,000
      await systems()
        .Core.connect(owner)
        .configureMaximumMarketCollateral(marketId(), collateralAddress(), 1000);
    });

    const configuredMaxAmount = ethers.utils.parseEther('1234');

    describe('configureMaximumMarketCollateral()', () => {
      before(restore);

      it('is only owner', async () => {
        await assertRevert(
          systems()
            .Core.connect(user1)
            .configureMaximumMarketCollateral(marketId(), collateralAddress(), 1000),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Core
        );
      });

      describe('successful invoke', () => {
        let tx: ethers.providers.TransactionReceipt;
        before('configure', async () => {
          tx = await systems()
            .Core.connect(owner)
            .configureMaximumMarketCollateral(marketId(), collateralAddress(), configuredMaxAmount);
        });

        it('sets the new configured amount', async () => {
          assertBn.equal(
            await systems().Core.getMaximumMarketCollateral(marketId(), collateralAddress()),
            configuredMaxAmount
          );
        });

        it('only applies the amount to the specified market', async () => {
          assertBn.equal(
            await systems()
              .Core.connect(user1)
              .getMaximumMarketCollateral(marketId().add(1), collateralAddress()),
            0
          );
        });

        it('emits event', async () => {
          await assertEvent(
            tx,
            `MaximumMarketCollateralConfigured(${marketId()}, "${collateralAddress()}", ${configuredMaxAmount}, "${await owner.getAddress()}")`,
            systems().Core
          );
        });
      });
    });

    describe('deposit()', async () => {
      before(restore);

      before('configure max', async () => {
        await systems()
          .Core.connect(owner)
          .configureMaximumMarketCollateral(marketId(), collateralAddress(), configuredMaxAmount);
      });

      before('user approves', async () => {
        await collateralContract()
          .connect(user1)
          .approve(MockMarket().address, ethers.constants.MaxUint256);
      });

      let beforeCollateralBalance: ethers.BigNumber;
      before('record user collateral balance', async () => {
        beforeCollateralBalance = await collateralContract().balanceOf(await user1.getAddress());
      });

      it('only works for the market matching marketId', async () => {
        await assertRevert(
          systems().Core.connect(user1).depositMarketCollateral(marketId(), collateralAddress(), 1),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Core
        );
      });

      // temp skipped because this test succeeds but does not work on anvil for some reason
      it.skip('does not work when depositing over max amount', async () => {
        await assertRevert(
          MockMarket().connect(user1).deposit(collateralAddress(), configuredMaxAmount.add(1)),
          `InsufficientMarketCollateralDepositable(${marketId()}, "${collateralAddress()}", ${configuredMaxAmount.add(
            1
          )})`,
          systems().Core
        );
      });

      describe('invoked successfully', () => {
        let tx: ethers.providers.TransactionReceipt;
        before('deposit', async () => {
          tx = await MockMarket().connect(user1).deposit(collateralAddress(), configuredMaxAmount);
        });

        it('pulls in collateral', async () => {
          assertBn.equal(await collateralContract().balanceOf(MockMarket().address), 0);
          assertBn.equal(
            await collateralContract().balanceOf(await user1.getAddress()),
            beforeCollateralBalance.sub(configuredMaxAmount)
          );
        });

        it('returns collateral added', async () => {
          assertBn.equal(
            await systems()
              .Core.connect(user1)
              .getMarketCollateralAmount(marketId(), collateralAddress()),
            configuredMaxAmount
          );
        });

        it('reduces total balance', async () => {
          assertBn.equal(
            await systems().Core.connect(user1).getMarketTotalDebt(marketId()),
            configuredMaxAmount.sub(configuredMaxAmount.mul(2))
          );
        });

        it('emits event', async () => {
          await assertEvent(
            tx,
            `MarketCollateralDeposited(${marketId()}, "${collateralAddress()}", ${configuredMaxAmount.toString()}, "${
              MockMarket().address
            }")`,
            systems().Core
          );
        });
      });
    });

    describe('Withdraw()', async () => {
      before(restore);

      before('configure max', async () => {
        await systems()
          .Core.connect(owner)
          .configureMaximumMarketCollateral(marketId(), collateralAddress(), configuredMaxAmount);
      });

      before('deposit', async () => {
        await collateralContract()
          .connect(user1)
          .approve(MockMarket().address, ethers.constants.MaxUint256);
        await MockMarket().connect(user1).deposit(collateralAddress(), configuredMaxAmount.div(2));
      });

      let beforeCollateralBalance: ethers.BigNumber;
      before('record user collateral balance', async () => {
        beforeCollateralBalance = await collateralContract().balanceOf(await user1.getAddress());
      });

      it('only works for the market matching marketId', async () => {
        await assertRevert(
          systems()
            .Core.connect(user1)
            .withdrawMarketCollateral(marketId(), collateralAddress(), configuredMaxAmount.div(2)),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Core
        );
      });

      // temp skipped because this test succeeds but fails on anvil due to parsing failure
      it.skip('cannot release more than the deposited amount', async () => {
        await assertRevert(
          MockMarket()
            .connect(user1)
            .withdraw(collateralAddress(), configuredMaxAmount.div(2).add(1)),
          `InsufficientMarketCollateralWithdrawable(${marketId()}, "${collateralAddress()}", ${configuredMaxAmount
            .div(2)
            .add(1)
            .toString()})`,
          systems().Core
        );
      });

      describe('successful withdraw partial', async () => {
        let tx: ethers.providers.TransactionReceipt;
        before('withdraw', async () => {
          tx = await (
            await MockMarket()
              .connect(user1)
              .withdraw(collateralAddress(), configuredMaxAmount.div(2).div(4))
          ).wait();
        });

        it('pushes out collateral', async () => {
          assertBn.equal(await collateralContract().balanceOf(MockMarket().address), 0);
          assertBn.equal(
            await collateralContract().balanceOf(await user1.getAddress()),
            beforeCollateralBalance.add(configuredMaxAmount.div(2).div(4))
          );
        });

        it('reduces market deposited collateral', async () => {
          assertBn.equal(
            await systems()
              .Core.connect(user1)
              .getMarketCollateralAmount(marketId(), collateralAddress()),
            configuredMaxAmount.div(2).sub(configuredMaxAmount.div(2).div(4))
          );
        });

        it('increases total balance', async () => {
          assertBn.equal(
            await systems().Core.connect(user1).getMarketTotalDebt(marketId()),
            ethers.BigNumber.from(0).sub(
              configuredMaxAmount.div(2).sub(configuredMaxAmount.div(2).div(4))
            )
          );
        });

        it('emits event', async () => {
          await assertEvent(
            tx,
            `MarketCollateralWithdrawn(${marketId()}, "${collateralAddress()}", ${configuredMaxAmount
              .div(2)
              .div(4)
              .toString()}, "${MockMarket().address}")`,
            systems().Core
          );
        });

        describe('successful withdraw full', async () => {
          before('withdraw', async () => {
            // this should be the amount remaining
            await MockMarket()
              .connect(user1)
              .withdraw(
                collateralAddress(),
                configuredMaxAmount.div(2).sub(configuredMaxAmount.div(2).div(4))
              );
          });

          it('shows market has no more deposited collateral', async () => {
            assertBn.equal(
              await systems()
                .Core.connect(user1)
                .getMarketCollateralAmount(marketId(), collateralAddress()),
              0
            );
          });
        });
      });
    });
  });
});
