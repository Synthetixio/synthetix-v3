//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Margin} from "../storage/Margin.sol";
import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import "../interfaces/IMarginModule.sol";

contract MarginModule is IMarginModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    /**
     * @dev Validates whether the margin requirements are acceptable after withdrawing.
     */
    function validatePositionPostWithdraw(
        uint128 accountId,
        Position.Data storage position,
        PerpMarket.Data storage market
    ) private view {
        uint256 oraclePrice = market.getOraclePrice();
        uint256 marginUsd = Margin.getMarginUsd(accountId, market, oraclePrice);

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(market.id);

        // Ensure does not lead to instant liquidation.
        if (position.isLiquidatable(market, marginUsd, oraclePrice, marketConfig)) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        (uint256 im, , ) = Position.getLiquidationMarginUsd(position.size, oraclePrice, marketConfig);
        if (marginUsd < im) {
            revert ErrorUtil.InsufficientMargin();
        }
    }

    /** @dev Validates whether an order exists and if that order can be cancelled before performing margin ops. */
    function validateOrderAvailability(
        uint128 accountId,
        uint128 marketId,
        PerpMarket.Data storage market,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        Order.Data storage order = market.orders[accountId];

        // Margin cannot be modified if order is currently pending.
        if (order.sizeDelta != 0) {
            // Check if this order can be cancelled. If so, cancel and then proceed.
            if (block.timestamp > order.commitmentTime + globalConfig.maxOrderAge) {
                delete market.orders[accountId];
                emit OrderCanceled(accountId, marketId, order.commitmentTime);
            } else {
                revert ErrorUtil.OrderFound();
            }
        }
    }

    /**
     * @dev Performs an ERC20 transfer, deposits collateral to Synthetix, and emits event.
     */
    function transferAndDeposit(
        uint128 marketId,
        uint256 amount,
        uint128 synthMarketId,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
            globalConfig.synthetix.depositMarketUsd(marketId, address(this), amount);
        } else {
            ITokenModule synth = ITokenModule(globalConfig.spotMarket.getSynth(synthMarketId));
            synth.transferFrom(msg.sender, address(this), amount);
            globalConfig.synthetix.depositMarketCollateral(marketId, synth, amount);
        }
        emit MarginDeposit(msg.sender, address(this), amount, synthMarketId);
    }

    /**
     * @dev Performs an collateral withdraw from Synthetix, ERC20 transfer, and emits event.
     */
    function withdrawAndTransfer(
        uint128 marketId,
        uint256 amount,
        uint128 synthMarketId,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, amount);
        } else {
            ITokenModule synth = ITokenModule(globalConfig.spotMarket.getSynth(synthMarketId));
            globalConfig.synthetix.withdrawMarketCollateral(marketId, synth, amount);
            synth.transferFrom(address(this), msg.sender, amount);
        }
        emit MarginWithdraw(address(this), msg.sender, amount, synthMarketId);
    }

    /**
     * @inheritdoc IMarginModule
     */
    function withdrawAllCollateral(uint128 accountId, uint128 marketId) external {
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        // Prevent collateral transfers when there's a pending order.
        validateOrderAvailability(accountId, marketId, market, globalConfig);

        // Position is frozen due to prior flagged for liquidation.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        // Prevent collateral transfers when there's an open position.
        Position.Data storage position = market.positions[accountId];
        if (position.size != 0) {
            revert ErrorUtil.PositionFound(accountId, marketId);
        }
        (int256 fundingRate, ) = market.recomputeFunding(market.getOraclePrice());
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.getCurrentFundingVelocity());

        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 synthMarketId;
        uint256 available;
        uint256 total;

        for (uint256 i = 0; i < length; i++) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = accountMargin.collaterals[synthMarketId];

            if (available == 0) {
                continue;
            }

            total += available;
            accountMargin.collaterals[synthMarketId] -= available;

            // Withdraw all available collateral for this `synthMarketId`.
            withdrawAndTransfer(marketId, available, synthMarketId, globalConfig);
        }
        if (total == 0) {
            revert ErrorUtil.NilCollateral();
        }
    }

    /**
     * @inheritdoc IMarginModule
     */
    function modifyCollateral(uint128 accountId, uint128 marketId, uint128 synthMarketId, int256 amountDelta) external {
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        // Prevent collateral transfers when there's a pending order.
        validateOrderAvailability(accountId, marketId, market, globalConfig);

        // Prevent collateral transfers when there's a pending order.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Position is frozen due to prior flagged for liquidation.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 absAmountDelta = MathUtil.abs(amountDelta);
        uint256 availableAmount = accountMargin.collaterals[synthMarketId];

        Margin.CollateralType storage collateral = globalMarginConfig.supported[synthMarketId];
        uint256 maxAllowable = collateral.maxAllowable;

        // Prevent any operations if this synth isn't supported as collateral.
        if (maxAllowable == 0) {
            revert ErrorUtil.UnsupportedCollateral(synthMarketId);
        }

        // Revert on zero amount operations rather than no-op.
        if (amountDelta == 0) {
            revert ErrorUtil.ZeroAmount();
        }

        (int256 fundingRate, ) = market.recomputeFunding(market.getOraclePrice());
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.getCurrentFundingVelocity());

        // > 0 is a deposit whilst < 0 is a withdrawal.
        if (amountDelta > 0) {
            // Verify whether this will exceed the maximum allowable collateral amount.
            if (availableAmount + absAmountDelta > maxAllowable) {
                revert ErrorUtil.MaxCollateralExceeded(absAmountDelta, maxAllowable);
            }
            accountMargin.collaterals[synthMarketId] += absAmountDelta;
            transferAndDeposit(marketId, absAmountDelta, synthMarketId, globalConfig);
        } else {
            // Verify the collateral previously associated to this account is enough to cover withdrawals.
            if (availableAmount < absAmountDelta) {
                revert ErrorUtil.InsufficientCollateral(synthMarketId, availableAmount, absAmountDelta);
            }

            accountMargin.collaterals[synthMarketId] -= absAmountDelta;

            // If an open position exists, verify this does _not_ place them into instant liquidation.
            //
            // Ensure we perform this _after_ the accounting update so marginUsd uses with post withdrawal
            // collateral amounts.
            Position.Data storage position = market.positions[accountId];
            if (position.size != 0) {
                validatePositionPostWithdraw(accountId, position, market);
            }

            withdrawAndTransfer(marketId, absAmountDelta, synthMarketId, globalConfig);
        }
    }

    /**
     * @inheritdoc IMarginModule
     */
    function setCollateralConfiguration(uint128[] calldata synthMarketIds, uint128[] calldata maxAllowables) external {
        OwnableStorage.onlyOwner();

        // Ensure all arrays have the same length.
        if (synthMarketIds.length != maxAllowables.length) {
            revert ErrorUtil.ArrayLengthMismatch();
        }

        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        // Clear existing collateral configuration to be replaced with new.
        uint256 length0 = globalMarginConfig.supportedSynthMarketIds.length;
        for (uint256 i = 0; i < length0; ) {
            uint128 synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            delete globalMarginConfig.supported[synthMarketId];

            // Revoke access after wiping collateral from supported market collateral.
            //
            // TODO: Add this back later. Synthetix IERC20.approve contracts throw InvalidParameter when amount = 0.
            //
            // IERC20(collateralType).approve(address(this), 0);

            unchecked {
                i++;
            }
        }
        delete globalMarginConfig.supportedSynthMarketIds;

        // Update with passed in configuration.
        uint256 length1 = synthMarketIds.length;
        address[] memory newSupportedSynthMarketIds = new address[](length1);
        for (uint256 i = 0; i < length1; ) {
            uint128 synthMarketId = synthMarketIds[i];
            ITokenModule synth = globalMarketConfig.spotMarket.getSynth(synthMarketId);

            // Perform approve _once_ when this collateral is added as a supported collateral.
            uint128 maxAllowable = maxAllowables[i];
            uint256 maxUint = type(uint256).max;

            synth.approve(address(globalMarketConfig.synthetix), maxUint);
            synth.approve(address(this), maxUint);
            globalMarginConfig.supported[synthMarketId] = Margin.CollateralType(maxAllowable);
            newSupportedSynthMarketIds[i] = synthMarketId;

            unchecked {
                i++;
            }
        }
        globalMarginConfig.supportedSynthMarketIds = newSupportedSynthMarketIds;

        emit CollateralConfigured(msg.sender, length1);
    }

    // --- Views --- //

    /**
     * @inheritdoc IMarginModule
     */
    function getConfiguredCollaterals() external view returns (AvailableCollateral[] memory) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        MarginModule.AvailableCollateral[] memory collaterals = new AvailableCollateral[](length);
        uint128 synthMarketId;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            Margin.CollateralType storage c = globalMarginConfig.supported[synthMarketId];
            collaterals[i] = AvailableCollateral(synthMarketId, c.maxAllowable);

            unchecked {
                i++;
            }
        }

        return collaterals;
    }

    /**
     * @inheritdoc IMarginModule
     */
    function getCollateralUsd(uint128 accountId, uint128 marketId) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.exists(marketId);
        return Margin.getCollateralUsd(accountId, marketId);
    }

    /**
     * @inheritdoc IMarginModule
     */
    function getMarginUsd(uint128 accountId, uint128 marketId) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return Margin.getMarginUsd(accountId, market, market.getOraclePrice());
    }
}
