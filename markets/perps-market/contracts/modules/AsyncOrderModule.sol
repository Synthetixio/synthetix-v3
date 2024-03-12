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
import {BaseQuantoPerUSDInt128, BaseQuantoPerUSDInt256, USDPerBaseUint256, USDPerQuantoUint256, QuantoUint256, USDUint256, InteractionsQuantoUint256} from '@kwenta/quanto-dimensions/src/UnitTypes.sol';

/**
 * @title Module for committing async orders.
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using AsyncOrder for AsyncOrder.Data;
    using PerpsAccount for PerpsAccount.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using InteractionsQuantoUint256 for QuantoUint256;

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external override returns (AsyncOrder.Data memory retOrder, USDUint256 fees) {
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
        if (order.request.sizeDelta.unwrap() != 0) {
            // @notice not including the expiration time since it requires the previous settlement strategy to be loaded and enabled, otherwise loading it will revert and will prevent new orders to be committed
            emit PreviousOrderExpired(
                order.request.marketId,
                order.request.accountId,
                order.request.sizeDelta.unwrap(),
                order.request.acceptablePrice.unwrap(),
                order.commitmentTime,
                order.request.trackingCode
            );
        }

        order.updateValid(commitment);

        (, USDUint256 feesAccrued, , ) = order.validateRequest(
            strategy,
            PerpsPrice.getCurrentPrice(commitment.marketId, PerpsPrice.Tolerance.DEFAULT)
        );

        emit OrderCommitted(
            commitment.marketId,
            commitment.accountId,
            strategy.strategyType,
            commitment.sizeDelta.unwrap(),
            commitment.acceptablePrice.unwrap(),
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
        BaseQuantoPerUSDInt128 sizeDelta
    ) external view override returns (QuantoUint256 orderFees, USDPerBaseUint256 fillPrice) {
        (orderFees, fillPrice) = _computeOrderFees(
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
        BaseQuantoPerUSDInt128 sizeDelta,
        USDPerBaseUint256 price
    ) external view override returns (QuantoUint256 orderFees, USDPerBaseUint256 fillPrice) {
        (orderFees, fillPrice) = _computeOrderFees(marketId, sizeDelta, price);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function getSettlementRewardCost(
        uint128 marketId,
        uint128 settlementStrategyId
    ) external view override returns (USDUint256) {
        return
            AsyncOrder.settlementRewardCost(
                PerpsMarketConfiguration.loadValidSettlementStrategy(marketId, settlementStrategyId)
            );
    }

    function requiredMarginForOrder(
        uint128 accountId,
        uint128 marketId,
        BaseQuantoPerUSDInt128 sizeDelta
    ) external view override returns (USDUint256 requiredMargin) {
        return
            _requiredMarginForOrder(
                accountId,
                marketId,
                sizeDelta,
                PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
            );
    }

    function requiredMarginForOrderWithPrice(
        uint128 accountId,
        uint128 marketId,
        BaseQuantoPerUSDInt128 sizeDelta,
        USDPerBaseUint256 price
    ) external view override returns (USDUint256 requiredMargin) {
        return _requiredMarginForOrder(accountId, marketId, sizeDelta, price);
    }

    function _requiredMarginForOrder(
        uint128 accountId,
        uint128 marketId,
        BaseQuantoPerUSDInt128 sizeDelta,
        USDPerBaseUint256 orderPrice
    ) internal view returns (USDUint256 requiredMargin) {
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            marketId
        );

        Position.Data storage oldPosition = PerpsMarket.accountPosition(marketId, accountId);
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        (USDUint256 currentInitialMargin, , ) = account.getAccountRequiredMargins(
            PerpsPrice.Tolerance.DEFAULT
        );
        (QuantoUint256 orderFees, USDPerBaseUint256 fillPrice) = _computeOrderFees(marketId, sizeDelta, orderPrice);
        BaseQuantoPerUSDInt128 newPositionSize = oldPosition.size + sizeDelta;
        return
            AsyncOrder.getRequiredMarginWithNewPosition(
                account,
                marketConfig,
                marketId,
                oldPosition.size,
                newPositionSize,
                fillPrice,
                currentInitialMargin
            ) + orderFees.mulDecimalToUSD(PerpsPrice.getCurrentQuantoPrice(marketId, PerpsPrice.Tolerance.DEFAULT));
    }

    function _computeOrderFees(
        uint128 marketId,
        BaseQuantoPerUSDInt128 sizeDelta,
        USDPerBaseUint256 orderPrice
    ) private view returns (QuantoUint256 orderFees, USDPerBaseUint256 fillPrice) {
        BaseQuantoPerUSDInt256 skew = PerpsMarket.load(marketId).skew;
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            marketId
        );
        fillPrice = AsyncOrder.calculateFillPrice(
            skew,
            marketConfig.skewScale,
            sizeDelta,
            orderPrice
        );

        orderFees = AsyncOrder.calculateOrderFee(
            sizeDelta,
            fillPrice,
            skew,
            marketConfig.orderFees
        );
    }
}
