//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../storage/AsyncOrder.sol";
import "../interfaces/IAsyncOrderModule.sol";

/**
 * @title Module to process asyncronous orders
 * @notice See README.md for an overview of asyncronous orders
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using DecimalMath for int64;
    using AsyncOrderClaim for AsyncOrderClaim.Data;
    using AsyncOrderConfiguration for AsyncOrderConfiguration.Data;

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitOrder(
        uint128 marketId,
        Transaction.Type orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount,
        address referrer
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim)
    {
        // validation checks
        Transaction.isAsyncTransaction(orderType);
        SpotMarketFactory.load().isValidMarket(marketId);
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        asyncOrderConfiguration.isValidSettlementStrategy(settlementStrategyId);

        uint amountEscrowed;
        // setup data to create async order based on transaction type
        if (orderType == Transaction.Type.ASYNC_BUY) {
            asyncOrderConfiguration.isValidAmount(settlementStrategyId, amountProvided);
            SpotMarketFactory.load().usdToken.transferFrom(
                msg.sender,
                address(this),
                amountProvided
            );

            amountEscrowed = amountProvided;
        }

        if (orderType == Transaction.Type.ASYNC_SELL) {
            // Get the dollar value of the provided synths
            uint256 usdAmount = Price.synthUsdExchangeRate(
                marketId,
                amountProvided,
                Transaction.Type.ASYNC_SELL
            );

            // ensures that the amount provided is greater than the settlement reward
            asyncOrderConfiguration.isValidAmount(settlementStrategyId, usdAmount);
            // using escrow in case of decaying token value
            amountEscrowed = AsyncOrder.transferIntoEscrow(marketId, msg.sender, amountProvided);
        }

        // Adjust async order data
        AsyncOrder.Data storage asyncOrderData = AsyncOrder.load(marketId);
        asyncOrderId = ++asyncOrderData.totalClaims;

        uint settlementDelay = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[settlementStrategyId]
            .settlementDelay;

        asyncOrderClaim = AsyncOrderClaim.create(
            marketId,
            asyncOrderId,
            orderType,
            amountEscrowed,
            settlementStrategyId,
            block.timestamp + settlementDelay,
            minimumSettlementAmount,
            msg.sender,
            referrer
        );

        // Emit event
        emit OrderCommitted(marketId, orderType, amountProvided, asyncOrderId, msg.sender, referrer);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        asyncOrderClaim.checkClaimValidity();
        asyncOrderClaim.isEligibleForCancellation(
            AsyncOrderConfiguration.load(marketId).settlementStrategies[
                asyncOrderClaim.settlementStrategyId
            ]
        );

        _issueRefund(marketId, asyncOrderId, asyncOrderClaim);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    // solc-ignore-next-line func-mutability
    function getAsyncOrderClaim(
        uint128 marketId,
        uint128 asyncOrderId
    ) external view override returns (AsyncOrderClaim.Data memory) {
        return AsyncOrderClaim.load(marketId, asyncOrderId);
    }

    /**
     * @dev used for cancel orders
     */
    function _issueRefund(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim
    ) private {
        address trader = asyncOrderClaim.owner;

        // claim is no longer valid
        asyncOrderClaim.settledAt = block.timestamp;

        // Return escrowed funds
        if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_BUY) {
            ITokenModule(SpotMarketFactory.load().usdToken).transfer(
                trader,
                asyncOrderClaim.amountEscrowed
            );
        } else if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_SELL) {
            AsyncOrder.transferFromEscrow(marketId, trader, asyncOrderClaim.amountEscrowed);
        }

        // Emit event
        emit OrderCancelled(marketId, asyncOrderId, asyncOrderClaim, trader);
    }
}
