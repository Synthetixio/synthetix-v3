import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ethers, Signer } from 'ethers';
import { bootstrapWithMockMarketAndPool } from '../../../bootstrap';
import { verifyUsesFeatureFlag } from '../../../verifications';

describe('MarketCollateralModule.withdrawMarketCollateral()', function () {
  const { signers, systems, MockMarket, marketId, collateralAddress, collateralContract, restore } =
    bootstrapWithMockMarketAndPool();

  let owner: Signer, user1: Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();

    // The owner assigns a maximum of 1,000
    await systems()
      .Core.connect(owner)
      .configureMaximumMarketCollateral(marketId(), collateralAddress(), 1000);
  });

  const configuredMaxAmount = ethers.utils.parseEther('1234');

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
    await MockMarket()
      .connect(user1)
      .depositCollateral(collateralAddress(), configuredMaxAmount.div(2));
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

  it('cannot release more than the deposited amount', async () => {
    await assertRevert(
      MockMarket()
        .connect(user1)
        .withdrawCollateral(collateralAddress(), configuredMaxAmount.div(2).add(1)),
      `InsufficientMarketCollateralWithdrawable("${marketId()}", "${collateralAddress()}", "${configuredMaxAmount
        .div(2)
        .add(1)
        .toString()}")`,
      systems().Core
    );
  });

  verifyUsesFeatureFlag(
    () => systems().Core,
    'withdrawMarketCollateral',
    () =>
      MockMarket()
        .connect(user1)
        .withdrawCollateral(collateralAddress(), configuredMaxAmount.div(2).div(4))
  );

  describe('successful withdraw partial', async () => {
    let tx: ethers.providers.TransactionReceipt;
    before('withdraw', async () => {
      tx = await (
        await MockMarket()
          .connect(user1)
          .withdrawCollateral(collateralAddress(), configuredMaxAmount.div(2).div(4))
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
      const tokenAmount = configuredMaxAmount.div(2).div(4).toString();
      const sender = MockMarket().address;
      const creditCapacity = ethers.utils.parseEther('1000');
      const netIssuance = 0;
      const depositedCollateralValue = (
        await systems()
          .Core.connect(user1)
          .getMarketCollateralAmount(marketId(), collateralAddress())
      ).toString();
      const reportedDebt = 0;
      await assertEvent(
        tx,
        `MarketCollateralWithdrawn(${[
          marketId(),
          `"${collateralAddress()}"`,
          tokenAmount,
          `"${sender}"`,
          creditCapacity,
          netIssuance,
          depositedCollateralValue,
          reportedDebt,
        ].join(', ')})`,
        systems().Core
      );
    });

    describe('successful withdraw full', async () => {
      before('withdraw', async () => {
        // this should be the amount remaining
        await MockMarket()
          .connect(user1)
          .withdrawCollateral(
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

  describe('cannot withdraw collateral when credit capacity is over-utilized', async () => {
    before('deposit collateral and withdraw maximum amount of USD', async () => {
      await MockMarket().connect(user1).depositCollateral(collateralAddress(), configuredMaxAmount);

      const totalWithdrawableUsd = await systems()
        .Core.connect(user1)
        .getWithdrawableMarketUsd(marketId());
      await MockMarket().connect(user1).withdrawUsd(totalWithdrawableUsd);
    });

    it('reverts when attempting to withdraw collateral', async () => {
      const totalWithdrawableCollateral = await systems()
        .Core.connect(user1)
        .getMarketCollateralAmount(marketId(), collateralAddress());
      await assertRevert(
        MockMarket()
          .connect(user1)
          .withdrawCollateral(collateralAddress(), totalWithdrawableCollateral),
        `InsufficientMarketCollateralWithdrawable("${marketId()}", "${collateralAddress()}", "${totalWithdrawableCollateral}")`,
        systems().Core
      );
    });
  });
});
