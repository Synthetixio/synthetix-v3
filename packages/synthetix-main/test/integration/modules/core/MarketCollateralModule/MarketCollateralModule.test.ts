import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrapWithMockMarketAndPool } from '../../../bootstrap';

describe('MarketCollateralModule', function () {
  const { signers, systems, MockMarket, marketId, collateralAddress, collateralContract } =
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

    describe('when some markets are created', function () {
      it('allows the owner to set maximum depositable amounts for a market', async () => {
        // Start with a maximum of 0
        await systems()
          .Core.connect(owner)
          .configureMaximumMarketCollateral(marketId(), collateralAddress(), 0);

        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMaximumMarketCollateral(marketId(), collateralAddress()),
          0
        );

        // The owner assigns a maximum of 1,000
        await systems()
          .Core.connect(owner)
          .configureMaximumMarketCollateral(marketId(), collateralAddress(), 1000);

        // The user unsuccessfully assigns a maximum of 2,000
        await assertRevert(
          systems()
            .Core.connect(user1)
            .configureMaximumMarketCollateral(marketId(), collateralAddress(), 2000),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Core
        );

        // Verify that the maximum has been updated to 1,000
        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMaximumMarketCollateral(marketId(), collateralAddress()),
          1000
        );

        // Verify that another market still has a maximum of 0
        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMaximumMarketCollateral(marketId().add(1), collateralAddress()),
          0
        );
      });

      it('only allows the market to deposit the maximum amount', async () => {
        await collateralContract().connect(user1).approve(MockMarket().address, 1000);
        await MockMarket().connect(user1).depositCollateral(collateralAddress(), 500);

        // Verify that we cannot deposit a total of 1,001
        await assertRevert(MockMarket().connect(user1).depositCollateral(collateralAddress(), 501));

        await MockMarket().connect(user1).depositCollateral(collateralAddress(), 500);

        // Verify that the total amount deposited is 1,000
        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMarketCollateralAmount(marketId(), collateralAddress()),
          1000
        );

        // Withdraw the 1,000 to reset
        await MockMarket().connect(user1).withdrawCollateral(collateralAddress(), 1000);
      });

      it('disallows withdrawing more collateral than it has deposited', async () => {
        await collateralContract().connect(user1).approve(MockMarket().address, 1000);
        await MockMarket().connect(user1).depositCollateral(collateralAddress(), 500);

        // Verify that the total amount deposited is 500
        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMarketCollateralAmount(marketId(), collateralAddress()),
          500
        );

        // Verify that 501 cannot be withdrawn
        await assertRevert(
          MockMarket().connect(user1).withdrawCollateral(collateralAddress(), 501)
        );

        // Verify that the total amount deposited is still 500
        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMarketCollateralAmount(marketId(), collateralAddress()),
          500
        );

        await MockMarket().connect(user1).withdrawCollateral(collateralAddress(), 500);

        // Verify that the total amount deposited is 0
        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMarketCollateralAmount(marketId(), collateralAddress()),
          0
        );
      });

      it('modifies values as expected', async () => {
        const initialProtocolBalance = await collateralContract()
          .connect(user1)
          .balanceOf(systems().Core.address);
        const initialUserBalance = await collateralContract()
          .connect(user1)
          .balanceOf(user1.getAddress());
        const initialWithdrawableUsd = await systems()
          .Core.connect(user1)
          .getWithdrawableUsd(marketId());
        const initialMarketTotalBalance = await systems()
          .Core.connect(user1)
          .getMarketTotalBalance(marketId());

        await collateralContract().connect(user1).approve(MockMarket().address, 1000);
        await MockMarket().connect(user1).depositCollateral(collateralAddress(), 1000);

        // Verify that the total amount deposited is 1000
        assertBn.equal(
          await systems()
            .Core.connect(user1)
            .getMarketCollateralAmount(marketId(), collateralAddress()),
          1000
        );

        // Verify that the amount in the main proxy increased by 1000
        const newProtocolBalance = await collateralContract()
          .connect(user1)
          .balanceOf(systems().Core.address);
        assertBn.equal(initialProtocolBalance.add(1000), newProtocolBalance);

        // Verify that the amount in the user contract decreased by 1000
        const newUserBalance = await collateralContract()
          .connect(user1)
          .balanceOf(user1.getAddress());
        assertBn.equal(initialUserBalance.sub(1000), newUserBalance);

        // Retrieve collateral value
        const collateralValue = (
          await systems().Core.connect(user1).getCollateralPrice(collateralAddress())
        ).mul(1000);

        // getWithdrawableUsd increases by the collateral value
        const newWithdrawableUsd = await systems()
          .Core.connect(user1)
          .getWithdrawableUsd(marketId());
        assertBn.equal(initialWithdrawableUsd.add(collateralValue), newWithdrawableUsd);

        // getMarketTotalBalance decreases by the collateral value
        const newMarketTotalBalance = await systems()
          .Core.connect(user1)
          .getMarketTotalBalance(marketId());
        assertBn.equal(initialMarketTotalBalance.sub(collateralValue), newMarketTotalBalance);
      });
    });
  });
});
