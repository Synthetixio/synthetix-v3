//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {LimitOrder} from "../storage/LimitOrder.sol";

/**
 * @title limit order module
 */
interface ILimitOrderModule {
    /**
     * @notice Thrown when attempting to use an invalid relayer
     */
    error LimitOrderRelayerInvalid(address relayer);

    // TODO take this out if we allow multiple relayers
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
    error LimitOrderAmountMismatch(int256 shortAmount, int256 longAmount);

    /**
     * @notice Gets the current limit order nonce for an account
     * @param accountId the account id
     * @return orderNonce the current limit order nonce
     */
    function getLimitOrderNonce(
        uint128 accountId
    ) external view returns (uint256 orderNonce);

    /**
     * @notice Settles long and short limit orders of matching amounts submitted by a valid relayer
     * @param longOrder a limit order going long on a given market
     * @param longSig a signature used to validate the long market ordert
     * @param shortOrder a limit order going short on a given market
     * @param shortSig a signature used to validate the short market ordert
     */
    function settleLimitOrders(
        LimitOrder.SignedOrderRequest calldata longOrder,
        bytes calldata longSig,
        LimitOrder.SignedOrderRequest calldata shortOrder,
        bytes calldata shortSig
    ) external;
}
