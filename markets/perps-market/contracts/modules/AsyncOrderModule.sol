//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {Flags} from "../utils/Flags.sol";

/**
 * @title Module for committing async orders.
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using AsyncOrder for AsyncOrder.Data;
    using PerpsAccount for PerpsAccount.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external override returns (AsyncOrder.Data memory retOrder, uint256 fees) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        PerpsMarket.loadValid(commitment.marketId);

        // Check if commitment.accountId is valid
        Account.exists(commitment.accountId);

        // Check ERC2771Context._msgSender() can commit order for commitment.accountId
        Account.loadAccountAndValidatePermission(
            commitment.accountId,
            AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION
        );

        GlobalPerpsMarket.load().checkLiquidation(commitment.accountId);

        SettlementStrategy.Data storage strategy = PerpsMarketConfiguration
            .loadValidSettlementStrategy(commitment.marketId, commitment.settlementStrategyId);

        AsyncOrder.Data storage order = AsyncOrder.load(commitment.accountId);

        // if order (previous) sizeDelta is not zero and didn't revert while checking, it means the previous order expired
        if (order.request.sizeDelta != 0) {
            // @notice not including the expiration time since it requires the previous settlement strategy to be loaded and enabled, otherwise loading it will revert and will prevent new orders to be committed
            emit PreviousOrderExpired(
                order.request.marketId,
                order.request.accountId,
                order.request.sizeDelta,
                order.request.acceptablePrice,
                order.commitmentTime,
                order.request.trackingCode
            );
        }

        order.updateValid(commitment);

        (, uint256 feesAccrued, , ) = order.validateRequest(
            strategy,
            PerpsPrice.getCurrentPrice(commitment.marketId, PerpsPrice.Tolerance.DEFAULT)
        );

        emit OrderCommitted(
            commitment.marketId,
            commitment.accountId,
            strategy.strategyType,
            commitment.sizeDelta,
            commitment.acceptablePrice,
            order.commitmentTime,
            order.commitmentTime + strategy.commitmentPriceDelay,
            order.commitmentTime + strategy.settlementDelay,
            order.commitmentTime + strategy.settlementDelay + strategy.settlementWindowDuration,
            commitment.trackingCode,
            ERC2771Context._msgSender()
        );

        return (order, feesAccrued);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    // solc-ignore-next-line func-mutability
    function getOrder(
        uint128 accountId
    ) external view override returns (AsyncOrder.Data memory order) {
        order = AsyncOrder.load(accountId);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function computeOrderFees(
        uint128 marketId,
        int128 sizeDelta
    ) external view override returns (uint256 orderFees, uint256 fillPrice) {
        return
            _computeOrderFeesWithPrice(
                marketId,
                sizeDelta,
                PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
            );
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function computeOrderFeesWithPrice(
        uint128 marketId,
        int128 sizeDelta,
        uint256 price
    ) external view override returns (uint256 orderFees, uint256 fillPrice) {
        return _computeOrderFeesWithPrice(marketId, sizeDelta, price);
    }

    function _computeOrderFeesWithPrice(
        uint128 marketId,
        int128 sizeDelta,
        uint256 price
    ) internal view returns (uint256 orderFees, uint256 fillPrice) {
        // create a fake order commitment request
        AsyncOrder.Data memory order = AsyncOrder.Data(
            0,
            AsyncOrder.OrderCommitmentRequest(marketId, 0, sizeDelta, 0, 0, bytes32(0), address(0))
        );

        PerpsAccount.Data storage account = PerpsAccount.load(order.request.accountId);

        // probably should be doing this but cant because the interface (view) doesn't allow it
        //perpsMarketData.recomputeFunding(orderPrice);

        PerpsAccount.MemoryContext memory ctx = account.getOpenPositionsAndCurrentPrices(
            PerpsPrice.Tolerance.DEFAULT
        );
        (, , , fillPrice, orderFees) = order.createUpdatedPosition(price, ctx);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function getSettlementRewardCost(
        uint128 marketId,
        uint128 settlementStrategyId
    ) external view override returns (uint256) {
        return
            AsyncOrder.settlementRewardCost(
                PerpsMarketConfiguration.loadValidSettlementStrategy(marketId, settlementStrategyId)
            );
    }

    function requiredMarginForOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta
    ) external view override returns (uint256 requiredMargin) {
        return
            _requiredMarginForOrderWithPrice(
                accountId,
                marketId,
                sizeDelta,
                PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
            );
    }

    function requiredMarginForOrderWithPrice(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 price
    ) external view override returns (uint256 requiredMargin) {
        return _requiredMarginForOrderWithPrice(accountId, marketId, sizeDelta, price);
    }

    function _requiredMarginForOrderWithPrice(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 price
    ) internal view returns (uint256 requiredMargin) {
        // create a fake order commitment request
        AsyncOrder.Data memory order = AsyncOrder.Data(
            0,
            AsyncOrder.OrderCommitmentRequest(
                marketId,
                accountId,
                sizeDelta,
                0,
                0,
                bytes32(0),
                address(0)
            )
        );

        PerpsAccount.Data storage account = PerpsAccount.load(order.request.accountId);

        // probably should be doing this but cant because the interface (view) doesn't allow it
        //perpsMarketData.recomputeFunding(orderPrice);

        PerpsAccount.MemoryContext memory ctx = account.getOpenPositionsAndCurrentPrices(
            PerpsPrice.Tolerance.DEFAULT
        );

        (ctx, , , , ) = order.createUpdatedPosition(price, ctx);

        (, uint256 totalCollateralValueWithoutDiscount) = account.getTotalCollateralValue(
            PerpsPrice.Tolerance.DEFAULT
        );

        (requiredMargin, , ) = PerpsAccount.getAccountRequiredMargins(
            ctx,
            totalCollateralValueWithoutDiscount
        );
    }
}
