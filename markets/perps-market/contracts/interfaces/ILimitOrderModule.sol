//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {LimitOrder} from "../storage/LimitOrder.sol";

/**
 * @title limit order module
 */
interface ILimitOrderModule {
    /**
     * @notice cancels a limit order nonce for an account and prevents it from being called
     * @param accountId id of the account used for the limit order
     * @param limitOrderNonce limit order nonce to cancel
     * @param price limit order nonce to cancel
     * @param amount limit order nonce to cancel
     */
    event LimitOrderCancelled(
        uint128 indexed accountId,
        uint256 limitOrderNonce,
        uint256 price,
        int256 amount
    );

    /**
     * @notice Gets fired when a new limit order is settled.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param price Price at which the limit order was settled.
     * @param pnl Pnl of the previous closed position.
     * @param accruedFunding Accrued funding of the previous closed position.
     * @param amount directional size of the limit order.
     * @param newSize New size of the position after settlement.
     * @param limitOrderFees Amount of fees collected by the protocol and relayer combined.
     * @param relayerFees Amount of fees collected by the relayer.
     * @param collectedFees Amount of fees collected by fee collector.
     * @param trackingCode Optional code for integrator tracking purposes.
     * @param interest interest charges
     */
    event LimitOrderSettled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 price,
        int256 pnl,
        int256 accruedFunding,
        int128 amount,
        int128 newSize,
        uint256 limitOrderFees,
        uint256 relayerFees,
        uint256 collectedFees,
        bytes32 indexed trackingCode,
        uint256 interest
    );

    /**
     * @notice thrown when a limit order that is attempted to be cancelled has already been used
     * @param accountId id of the account used for the limit order
     * @param limitOrderNonce limit order nonce to cancel
     * @param price limit order nonce to cancel
     * @param amount limit order nonce to cancel
     */
    error LimitOrderAlreadyUsed(
        uint128 accountId,
        uint256 limitOrderNonce,
        uint256 price,
        int256 amount
    );

    /**
     * @notice Thrown when attempting to use two makers or two takers
     * @param shortIsMaker is the short a maker?
     * @param longIsMaker is the long a maker?
     */
    error MismatchingMakerTakerLimitOrder(bool shortIsMaker, bool longIsMaker);

    /**
     * @notice Thrown when attempting to use an invalid relayer
     * @param relayer address of the relayer submitted with a limit order
     */
    error LimitOrderRelayerInvalid(address relayer);

    /**
     * @notice Thrown when attempting to use two different relayers
     */
    error LimitOrderDifferentRelayer(address shortRelayer, address longRelayer);

    /**
     * @notice Thrown when attempting to use two different markets
     */
    error LimitOrderMarketMismatch(uint256 shortMarketId, uint256 longMarketId);

    /**
     * @notice Thrown when attempting to use an expired limit order on either side
     */
    error LimitOrderExpired(
        uint128 shortAccountId,
        uint256 shortExpiration,
        uint128 longAccountId,
        uint256 longExpiration,
        uint256 blockTimetamp
    );

    /**
     * @notice Thrown when attempting to use two different amounts
     */
    error LimitOrderAmountError(int256 shortAmount, int256 longAmount);

    /**
     * @notice cancels a limit order with a nonce from being called for an account
     * @param order the order to cancel
     * @param sig the order signature
     */
    function cancelLimitOrder(
        LimitOrder.SignedOrderRequest calldata order,
        LimitOrder.Signature calldata sig
    ) external;

    /**
     * @notice gets the fees for a limit order
     * @param marketId the id for the market
     * @param amount the amount for the order
     * @param price the price of the order
     * @param isMaker a boolean to get the fee for a taker vs maker
     * @return limitOrderFees the fees for the limit order
     */
    function getLimitOrderFees(
        uint128 marketId,
        int128 amount,
        uint256 price,
        bool isMaker
    ) external view returns (uint256);

    /**
     * @notice Settles long and short limit orders of matching amounts submitted by a valid relayer
     * @param longOrder a limit order going long on a given market
     * @param longSignature a signature used to validate the long market ordert
     * @param shortOrder a limit order going short on a given market
     * @param shortSignature a signature used to validate the short market ordert
     */
    function settleLimitOrder(
        LimitOrder.SignedOrderRequest calldata shortOrder,
        LimitOrder.Signature calldata shortSignature,
        LimitOrder.SignedOrderRequest calldata longOrder,
        LimitOrder.Signature calldata longSignature
    ) external;
}
