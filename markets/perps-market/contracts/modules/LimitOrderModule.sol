//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {SafeCastBytes32} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ILimitOrderModule} from "../interfaces/ILimitOrderModule.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {LimitOrder} from "../storage/LimitOrder.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";

bytes32 constant DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        ),
        keccak256(bytes("SyntheticPerpetualFutures")),
        keccak256(bytes("1")),
        block.chainId,
        address(this)
    )
);

/**
 * @title Module for settling signed P2P limit orders
 * @dev See ILimitOrderModule.
 */
contract LimitOrderModule is ILimitOrderModule {
    using LimitOrder for LimitOrder.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using SafeCastBytes32 for bytes32;

    /**
     * @inheritdoc ILimitOrderModule
     */
    function getLimitOrderNonce(uint128 accountId)
        external
        view
        override
        returns (uint256 orderNonce)
    {
        return LimitOrder.load().orderNonces(accountId);
    }

    /**
     * @inheritdoc ILimitOrderModule
     */
    function settleLimitOrder(
        LimitOrder.SignedOrderRequest calldata shortOrder,
        bytes32[3] calldata shortSig,
        LimitOrder.SignedOrderRequest calldata longOrder,
        bytes32[3] calldata longSig
    ) external {
        // Note might be able to remove this first check if it is checked later in the process already
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM); 
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM_LIMIT_ORDER);

        checkSignature(shortOrder, shortSig);
        checkSignature(longOrder, longSig);
        AsyncOrder.checkPendingOrder(shortOrder.accountId);
        AsyncOrder.checkPendingOrder(longOrder.accountId);

        // TODO take this out if we allow multiple relayers
        if (shortOrder.relayer != longOrder.relayer) {
            revert LimitOrderDifferentRelayer(shortOrder.relayer, longOrder.relayer);
        }
        if (shortOrder.marketId != longOrder.marketId) {
            revert LimitOrderMarketMismatch(shortOrder.marketId, longOrder.marketId);
        }
        // TODO check both relayers if we allow multiple
        uint256 shareRatioD18 = GlobalPerpsMarketConfiguration.load().getRelayerShare(longOrder.relayer);
        if (shareRatioD18 > 0) {
            revert LimitOrderRelayerInvalid(longOrder.relayer);
        }
        if (shortOrder.expiration > block.timestamp || longOrder.expiration > block.timestamp) {
            revert LimitOrderEpired(
                shortOrder.accountId,
                shortOrder.expiration,
                longOrder.accountId,
                longOrder.expiration,
                block.timestamp
            );
        }
        if (shortOrder.amount != longOrder.amount) {
            revert LimitOrderAmountMismatch(shortOrder.amount, longOrder.amount);
        }

        // not sure if these 2 lines are right. look into it further
        GlobalPerpsMarket.load().checkLiquidation(shortOrder.accountId);
        GlobalPerpsMarket.load().checkLiquidation(longOrder.accountId);
        // check if nonce is cancelled or used before here

        // Account.exists(commitment.accountId); // might need this. check later and delete if not needed

        // verify signatures like require(order.maker == ecrecover(keccak256(abi.encode(order, DOMAIN_SEPARATOR)), v, r, s), "LimitOrderModule: invalid signature");
        // confirm no pending orders exist for either account
        // check msg.sender is an endorsed relayer and is the same as the relayer value in both LimitOrder
        // verify expiration on both orders like require(order.expiration > block.timestamp, "LimitOrderModule: order expired");
        // check onchain price to make sure executing this change won't make either position is liquidatable (like current settlement logic)
        // look at existing code for margin on this part. for orders we have async pattern. commit to order at 12:50PM. we dont know the price.
        // bot picks up keeper fee with price at 12:50 and settles it. we also have checks with a looser staleness tolerance.
        // check for sufficient margin on both accounts (using amount/price)
        // see asyncOrder.validateRequest
        // check limitOrderNonce for both accounts
        // note we could have a method on the contract directly that lets a user cancel a limit order which has not been matched by passing in the nonce
        // Fees
        // Global configurable limit order maker fee %
        // Global configurable limit order taker fee %
        // Global configurable mapping of valid relayers and fee share (Pass this % of the total fee to the relayer)
        // Look at mapping for referral fees that already exist. only governance can update it. does 0 mean unset, etc...
        // Global configurable IFeeCollector for limit orders (Pass this % of the total fee to the fee collector)
        // update position for both accounts
        // increment limitOrderNonce on both accounts
        // emit events
        // upgrades - permissionless relayers, global liquidity w different relayers to match
    }

    function checkSignature(LimitOrder calldata order, bytes32[3] calldata sig) internal view {
        uint8 v = sig[64].toUint8();   
        bytes32 r = bytes32(sig[:32]);
        bytes32 s = bytes32(sig[32:64]);
        address signingAddress = ecrecover(
            keccak256(abi.encodePacked(DOMAIN_SEPARATOR, order)),
            v,
            r,
            s
        );

        Account.Data storage account = Account.load(order.accountId);
        if (
            !account.rbac.authorized(
                AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION,
                signingAddress
            )
        ) {
            revert Account.PermissionDenied(
                accountId,
                AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION,
                signingAddress
            );
        }
    }
}
