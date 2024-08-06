//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ILimitOrderModule} from "../interfaces/ILimitOrderModule.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";
import {IAccountEvents} from "../interfaces/IAccountEvents.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {LimitOrder} from "../storage/LimitOrder.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {Position} from "../storage/Position.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";
import "hardhat/console.sol";

/**
 * @title Module for settling signed P2P limit orders
 * @dev See ILimitOrderModule.
 */
contract LimitOrderModule is ILimitOrderModule, IMarketEvents, IAccountEvents {
    using DecimalMath for int128;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using LimitOrder for LimitOrder.Data;
    using Account for Account.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsMarket for PerpsMarket.Data;
    using Position for Position.Data;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;

    // keccak256("SignedOrderRequest(uint128 accountId,uint128 marketId,address relayer,int128 amount,uint256 price,limitOrderMaker bool,expiration uint256,nonce uint256,trackingCode bytes32)");
    bytes32 private constant _ORDER_TYPEHASH =
        0x4641f2e4f75597d1e96e7bdefb2097481b29cbfc2505e980f185449f02f5f52b;

    /**
     * @notice Thrown when there's not enough margin to cover the order and settlement costs associated.
     */
    error InsufficientMargin(int256 availableMargin, uint256 minMargin);

    // TODO add max limit order view function here and to the ILimitOrderModule
    /**
     * @inheritdoc ILimitOrderModule
     */
    // function getMaxOrderSize() external view {}

    /**
     * @inheritdoc ILimitOrderModule
     */
    function getLimitOrderFees(
        uint128 marketId,
        int128 amount,
        uint256 price,
        bool isMaker
    ) external view returns (uint256) {
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            marketId
        );
        return getLimitOrderFeesHelper(amount, price, isMaker, marketConfig);
    }

    /**
     * @inheritdoc ILimitOrderModule
     */
    function cancelLimitOrder(
        LimitOrder.SignedOrderRequest calldata order,
        LimitOrder.Signature calldata sig
    ) external {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        FeatureFlag.ensureAccessToFeature(Flags.LIMIT_ORDER);
        checkSigPermission(order, sig);
        LimitOrder.Data storage limitOrderData = LimitOrder.load();

        if (limitOrderData.isLimitOrderNonceUsed(order.accountId, order.nonce)) {
            revert LimitOrderAlreadyUsed(order.accountId, order.nonce, order.price, order.amount);
        } else {
            limitOrderData.markLimitOrderNonceUsed(order.accountId, order.nonce);
            emit LimitOrderCancelled(order.accountId, order.nonce, order.price, order.amount);
        }
    }

    /**
     * @inheritdoc ILimitOrderModule
     */
    function settleLimitOrder(
        LimitOrder.SignedOrderRequest calldata shortOrder,
        LimitOrder.Signature calldata shortSignature,
        LimitOrder.SignedOrderRequest calldata longOrder,
        LimitOrder.Signature calldata longSignature
    ) external {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        FeatureFlag.ensureAccessToFeature(Flags.LIMIT_ORDER);
        PerpsMarket.loadValid(shortOrder.marketId);

        checkSigPermission(shortOrder, shortSignature);
        checkSigPermission(longOrder, longSignature);

        uint256 lastPriceCheck = PerpsPrice.getCurrentPrice(
            shortOrder.marketId,
            PerpsPrice.Tolerance.DEFAULT
        );

        PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(shortOrder.marketId);
        perpsMarketData.recomputeFunding(lastPriceCheck);

        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            shortOrder.marketId
        );
        console.log("maxMarketSize", marketConfig.maxMarketSize);
        console.log("maxMarketValue", marketConfig.maxMarketValue);
        perpsMarketData.validateLimitOrderSize(
            marketConfig.maxMarketSize,
            marketConfig.maxMarketValue,
            longOrder.price,
            longOrder.amount
        );

        validateLimitOrder(shortOrder);
        validateLimitOrder(longOrder);
        validateLimitOrderPair(shortOrder, longOrder);

        uint256 shareRatioD18 = GlobalPerpsMarketConfiguration.load().relayerShare[
            longOrder.relayer
        ];
        if (shareRatioD18 == 0) {
            revert LimitOrderRelayerInvalid(longOrder.relayer);
        }

        (
            uint256 shortLimitOrderFees,
            Position.Data storage shortOldPosition,
            Position.Data memory shortNewPosition
        ) = validateRequest(shortOrder, lastPriceCheck, marketConfig, perpsMarketData);
        (
            uint256 longLimitOrderFees,
            Position.Data storage longOldPosition,
            Position.Data memory longNewPosition
        ) = validateRequest(longOrder, lastPriceCheck, marketConfig, perpsMarketData);

        settleRequest(shortOrder, shortLimitOrderFees, shortOldPosition, shortNewPosition);
        settleRequest(longOrder, longLimitOrderFees, longOldPosition, longNewPosition);
    }

    function checkSigPermission(
        LimitOrder.SignedOrderRequest calldata order,
        LimitOrder.Signature calldata sig
    ) internal {
        // Account.exists(order.accountId);
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator(),
                keccak256(
                    abi.encode(
                        _ORDER_TYPEHASH,
                        order.accountId,
                        order.marketId,
                        order.relayer,
                        order.amount,
                        order.price,
                        order.limitOrderMaker,
                        order.expiration,
                        order.nonce,
                        order.trackingCode
                    )
                )
            )
        );
        address signingAddress = ecrecover(digest, sig.v, sig.r, sig.s);

        Account.loadAccountAndValidateSignerPermission(
            order.accountId,
            AccountRBAC._PERPS_COMMIT_LIMIT_ORDER_PERMISSION,
            signingAddress
        );
    }

    function validateLimitOrder(LimitOrder.SignedOrderRequest calldata order) internal view {
        AsyncOrder.checkPendingOrder(order.accountId);
        PerpsAccount.validateMaxPositions(order.accountId, order.marketId);
        LimitOrder.load().isLimitOrderNonceUsed(order.accountId, order.nonce);
        GlobalPerpsMarket.load().checkLiquidation(order.accountId);
    }

    function validateLimitOrderPair(
        LimitOrder.SignedOrderRequest calldata shortOrder,
        LimitOrder.SignedOrderRequest calldata longOrder
    ) internal view {
        if (shortOrder.limitOrderMaker == longOrder.limitOrderMaker) {
            revert MismatchingMakerTakerLimitOrder(
                shortOrder.limitOrderMaker,
                longOrder.limitOrderMaker
            );
        }
        if (shortOrder.relayer != longOrder.relayer) {
            revert LimitOrderDifferentRelayer(shortOrder.relayer, longOrder.relayer);
        }
        if (shortOrder.marketId != longOrder.marketId) {
            revert LimitOrderMarketMismatch(shortOrder.marketId, longOrder.marketId);
        }
        if (shortOrder.expiration <= block.timestamp || longOrder.expiration <= block.timestamp) {
            revert LimitOrderExpired(
                shortOrder.accountId,
                shortOrder.expiration,
                longOrder.accountId,
                longOrder.expiration,
                block.timestamp
            );
        }
        if (shortOrder.amount >= 0 || (shortOrder.amount != -longOrder.amount)) {
            revert LimitOrderAmountError(shortOrder.amount, longOrder.amount);
        }
    }

    /**
     * @notice Checks if the limit order request is valid
     * it recomputes market funding rate, calculates fill price and fees for the order
     * and with that data it checks that:
     * - the account is eligible for liquidation
     * - the fill price is within the acceptable price range
     * - the position size doesn't exceed market configured limits
     * - the account has enough margin to cover for the fees
     * - the account has enough margin to not be liquidable immediately after the order is settled
     * if the order can be executed, it returns (runtime., oldPosition, newPosition)
     */
    function validateRequest(
        LimitOrder.SignedOrderRequest calldata order,
        uint256 lastPriceCheck,
        PerpsMarketConfiguration.Data storage marketConfig,
        PerpsMarket.Data storage perpsMarketData
    ) internal view returns (uint256, Position.Data storage oldPosition, Position.Data memory) {
        LimitOrder.ValidateRequestRuntime memory runtime;
        runtime.amount = order.amount;
        runtime.accountId = order.accountId;
        runtime.marketId = order.marketId;
        runtime.price = order.price;

        PerpsAccount.Data storage account = PerpsAccount.load(runtime.accountId);
        (
            runtime.isEligible,
            runtime.currentAvailableMargin,
            runtime.requiredInitialMargin,
            ,

        ) = account.isEligibleForLiquidation(PerpsPrice.Tolerance.DEFAULT);

        if (runtime.isEligible) {
            revert PerpsAccount.AccountLiquidatable(runtime.accountId);
        }

        runtime.limitOrderFees = getLimitOrderFeesHelper(
            order.amount,
            order.price,
            order.limitOrderMaker,
            marketConfig
        );

        oldPosition = PerpsMarket.accountPosition(runtime.marketId, runtime.accountId);
        runtime.newPositionSize = oldPosition.size + runtime.amount;

        // only account for negative pnl
        runtime.currentAvailableMargin += MathUtil.min(
            AsyncOrder.calculateStartingPnl(runtime.price, lastPriceCheck, runtime.newPositionSize),
            0
        );
        if (runtime.currentAvailableMargin < runtime.limitOrderFees.toInt()) {
            revert InsufficientMargin(runtime.currentAvailableMargin, runtime.limitOrderFees);
        }

        runtime.totalRequiredMargin =
            AsyncOrder.getRequiredMarginWithNewPosition(
                account,
                marketConfig,
                runtime.marketId,
                oldPosition.size,
                runtime.newPositionSize,
                runtime.price,
                runtime.requiredInitialMargin
            ) +
            runtime.limitOrderFees;

        if (runtime.currentAvailableMargin < runtime.totalRequiredMargin.toInt()) {
            revert InsufficientMargin(runtime.currentAvailableMargin, runtime.totalRequiredMargin);
        }
        runtime.newPosition = Position.Data({
            marketId: runtime.marketId,
            latestInteractionPrice: order.price.to128(),
            latestInteractionFunding: perpsMarketData.lastFundingValue.to128(),
            latestInterestAccrued: 0,
            size: runtime.newPositionSize
        });

        return (runtime.limitOrderFees, oldPosition, runtime.newPosition);
    }

    function settleRequest(
        LimitOrder.SignedOrderRequest calldata order,
        uint256 limitOrderFees,
        Position.Data storage oldPosition,
        Position.Data memory newPosition
    ) internal {
        LimitOrder.SettleRequestRuntime memory runtime;
        runtime.accountId = order.accountId;
        runtime.marketId = order.marketId;
        runtime.limitOrderFees = limitOrderFees;
        runtime.amount = order.amount;
        runtime.price = order.price;

        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(runtime.accountId);
        (runtime.pnl, , runtime.chargedInterest, runtime.accruedFunding, , ) = oldPosition.getPnl(
            order.price
        );
        runtime.pnlUint = MathUtil.abs(runtime.pnl);

        if (runtime.pnl > 0) {
            perpsAccount.updateCollateralAmount(SNX_USD_MARKET_ID, runtime.pnl);
        } else if (runtime.pnl < 0) {
            runtime.limitOrderFees += runtime.pnlUint;
        }

        // after pnl is realized, update position
        runtime.updateData = PerpsMarket.loadValid(runtime.marketId).updatePositionData(
            runtime.accountId,
            newPosition
        );
        perpsAccount.updateOpenPositions(runtime.marketId, newPosition.size);

        emit MarketUpdated(
            runtime.updateData.marketId,
            runtime.price,
            runtime.updateData.skew,
            runtime.updateData.size,
            runtime.amount,
            runtime.updateData.currentFundingRate,
            runtime.updateData.currentFundingVelocity,
            runtime.updateData.interestRate
        );

        // since margin is deposited when trader deposits, as long as the owed collateral is deducted
        // from internal accounting, fees are automatically realized by the stakers
        if (runtime.limitOrderFees > 0) {
            (runtime.deductedSynthIds, runtime.deductedAmount) = perpsAccount.deductFromAccount(
                runtime.limitOrderFees
            );
            for (
                runtime.synthDeductionIterator = 0;
                runtime.synthDeductionIterator < runtime.deductedSynthIds.length;
                runtime.synthDeductionIterator++
            ) {
                if (runtime.deductedAmount[runtime.synthDeductionIterator] > 0) {
                    emit CollateralDeducted(
                        runtime.accountId,
                        runtime.deductedSynthIds[runtime.synthDeductionIterator],
                        runtime.deductedAmount[runtime.synthDeductionIterator]
                    );
                }
            }
        }

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        (runtime.relayerFees, runtime.feeCollectorFees) = GlobalPerpsMarketConfiguration
            .load()
            .collectFees(limitOrderFees, order.relayer, factory);

        LimitOrder.load().markLimitOrderNonceUsed(runtime.accountId, order.nonce);
        // emit event
        emit LimitOrderSettled(
            runtime.marketId,
            runtime.accountId,
            runtime.price,
            runtime.pnl,
            runtime.accruedFunding,
            runtime.amount,
            runtime.newPosition.size,
            runtime.limitOrderFees,
            runtime.relayerFees,
            runtime.feeCollectorFees,
            order.trackingCode,
            runtime.chargedInterest
        );
    }

    // TODO double check math here
    function getLimitOrderFeesHelper(
        int128 amount,
        uint256 price,
        bool isMaker,
        PerpsMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256) {
        uint256 fees = isMaker
            ? marketConfig.orderFees.limitOrderMakerFee
            : marketConfig.orderFees.limitOrderTakerFee;

        return MathUtil.abs(amount).mulDecimal(price).mulDecimal(fees);
    }

    function domainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes("SyntheticPerpetualFutures")),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(this)
                )
            );
    }
}
