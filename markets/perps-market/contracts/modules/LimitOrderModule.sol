//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ILimitOrderModule} from "../interfaces/ILimitOrderModule.sol";

bytes32 constant DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        ),
        keccak256(bytes("SyntheticPerpetualFutures")),
        keccak256(bytes("1")),
        chainId,
        address(this)
    )
);

struct LimitOrder {
    uint makerId;
    uint takerId;
    uint marketId;
    address relayer;
    uint256 amount;
    uint256 price;
    uint256 expiration;
    uint256 nonce;
}

/**
 * @title Module for settling signed P2P limit orders
 * @dev See ILimitOrderModule.
 */
contract LimitOrderModule is ILimitOrderModule {
    function settleLimitOrder(
        LimitOrder calldata makerOrder,
        LimitOrder calldata takerOrder /* add signatures for both maker order and taker order */
    ) external {
        // get addresses associated with each position
        // verify signatures like require(order.maker == ecrecover(keccak256(abi.encode(order, DOMAIN_SEPARATOR)), v, r, s), "LimitOrderModule: invalid signature");
        // confirm no pending orders exist for either account
        // check msg.sender is an endorsed relayer and is the same as the relayer value in both LimitOrder
        // verify expiration on both orders like require(order.expiration > block.timestamp, "LimitOrderModule: order expired");
        // check onchain price to make sure executing this change won't make either position is liquidatable (like current settlement logic)
        // check for sufficient margin on both accounts (using amount/price)
        // see asyncOrder.validateRequest
        // check limitOrderNonce for both accounts
        // Fees
        // Global configurable limit order maker fee %
        // Global configurable limit order taker fee %
        // Global configurable mapping of valid relayers and fee share (Pass this % of the total fee to the relayer)
        // Global configurable IFeeCollector for limit orders (Pass this % of the total fee to the fee collector)
        // update position for both accounts
        // increment limitOrderNonce on both accounts
        // emit events
    }
}
