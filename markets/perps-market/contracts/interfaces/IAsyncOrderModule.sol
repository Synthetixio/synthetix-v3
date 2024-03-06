//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {BaseQuantoPerUSDInt128, USDPerBaseUint256, QuantoUint256, USDUint256} from 'quanto-dimensions/src/UnitTypes.sol';

/**
 * @title Module for committing and settling async orders.
 */
interface IAsyncOrderModule {
    /**
     * @notice Gets fired when a new order is committed.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param orderType Should send 0 (at time of writing) that correlates to the transaction type enum defined in SettlementStrategy.Type.
     * @param sizeDelta requested change in size of the order sent by the user.
     * @param acceptablePrice maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.
     * @param commitmentTime Time at which the order was committed.
     * @param settlementTime start time of the settlement window.
     * @param expirationTime Time at which the order expired.
     * @param trackingCode Optional code for integrator tracking purposes.
     * @param sender address of the sender of the order. Authorized to commit by account owner.
     */
    event OrderCommitted(
        uint128 indexed marketId,
        uint128 indexed accountId,
        SettlementStrategy.Type orderType,
        int128 sizeDelta,
        uint256 acceptablePrice,
        uint256 commitmentTime,
        uint256 expectedPriceTime,
        uint256 settlementTime,
        uint256 expirationTime,
        bytes32 indexed trackingCode,
        address sender
    );

    /**
     * @notice Gets fired when a new order is committed while a previous one was expired.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param sizeDelta requested change in size of the order sent by the user.
     * @param acceptablePrice maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.
     * @param commitmentTime Time at which the order was committed.
     * @param trackingCode Optional code for integrator tracking purposes.
     */
    event PreviousOrderExpired(
        uint128 indexed marketId,
        uint128 indexed accountId,
        int128 sizeDelta,
        uint256 acceptablePrice,
        uint256 commitmentTime,
        bytes32 indexed trackingCode
    );

    /**
     * @notice Commit an async order via this function
     * @param commitment Order commitment data (see AsyncOrder.OrderCommitmentRequest struct).
     * @return retOrder order details (see AsyncOrder.Data struct).
     * @return fees order fees (protocol + settler)
     */
    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external returns (AsyncOrder.Data memory retOrder, USDUint256 fees);

    /**
     * @notice Get async order claim details
     * @param accountId id of the account.
     * @return order async order claim details (see AsyncOrder.Data struct).
     */
    function getOrder(uint128 accountId) external view returns (AsyncOrder.Data memory order);

    /**
     * @notice Simulates what the order fee would be for the given market with the specified size.
     * @dev    Note that this does not include the settlement reward fee, which is based on the strategy type used
     * @param marketId id of the market.
     * @param sizeDelta size of position.
     * @return orderFees incurred fees.
     * @return fillPrice price at which the order would be filled.
     */
    function computeOrderFees(
        uint128 marketId,
        BaseQuantoPerUSDInt128 sizeDelta
    ) external view returns (QuantoUint256 orderFees, USDPerBaseUint256 fillPrice);

    /**
     * @notice Simulates what the order fee would be for the given market with the specified size.
     * @dev    Note that this does not include the settlement reward fee, which is based on the strategy type used
     * @param marketId id of the market.
     * @param sizeDelta size of position.
     * @param price price of the market.
     * @return orderFees incurred fees.
     * @return fillPrice price at which the order would be filled.
     */
    function computeOrderFeesWithPrice(
        uint128 marketId,
        BaseQuantoPerUSDInt128 sizeDelta,
        USDPerBaseUint256 price
    ) external view returns (QuantoUint256 orderFees, USDPerBaseUint256 fillPrice);

    /**
     * @notice Gets the settlement cost including keeper rewards and keeper costs.
     * @param marketId Id of the market.
     * @param settlementStrategyId Order size.
     * @return settlement cost.
     */
    function getSettlementRewardCost(
        uint128 marketId,
        uint128 settlementStrategyId
    ) external view returns (USDUint256);

    /**
     * @notice For a given market, account id, and a position size, returns the required total account margin for this order to succeed
     * @dev    Useful for integrators to determine if an order will succeed or fail
     * @param marketId id of the market.
     * @param accountId id of the trader account.
     * @param sizeDelta size of position.
     * @return requiredMargin margin required for the order to succeed.
     */
    function requiredMarginForOrder(
        uint128 marketId,
        uint128 accountId,
        BaseQuantoPerUSDInt128 sizeDelta
    ) external view returns (USDUint256 requiredMargin);

    /**
     * @notice For a given market, account id, and a position size, and expected price returns the required total account margin for this order to succeed
     * @dev    Useful for integrators to determine if an order will succeed or fail faking different price scenarios
     * @param marketId id of the market.
     * @param accountId id of the trader account.
     * @param sizeDelta size of position.
     * @param price price of the market.
     * @return requiredMargin margin required for the order to succeed.
     */
    function requiredMarginForOrderWithPrice(
        uint128 marketId,
        uint128 accountId,
        BaseQuantoPerUSDInt128 sizeDelta,
        USDPerBaseUint256 price
    ) external view returns (USDUint256 requiredMargin);
}
