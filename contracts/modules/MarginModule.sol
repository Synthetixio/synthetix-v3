//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {IMarginModule} from "../interfaces/IMarginModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Order} from "../storage/Order.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Margin} from "../storage/Margin.sol";

contract MarginModule is IMarginModule {
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Helpers --- //

    /**
     * @dev Post collateral withdraw validation to verify margin requirements are acceptable.
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

    /**
     * @dev Validates whether an order exists and if that order can be cancelled before performing margin ops.
     */
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
            globalConfig.synthetix.withdrawMarketCollateral(marketId, address(synth), amount);
            synth.transfer(msg.sender, amount);
        }
        emit MarginWithdraw(address(this), msg.sender, amount, synthMarketId);
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
            globalConfig.synthetix.depositMarketUsd(marketId, msg.sender, amount);
        } else {
            ITokenModule synth = ITokenModule(globalConfig.spotMarket.getSynth(synthMarketId));
            synth.transferFrom(msg.sender, address(this), amount);
            globalConfig.synthetix.depositMarketCollateral(marketId, address(synth), amount);
        }
        emit MarginDeposit(msg.sender, address(this), amount, synthMarketId);
    }

    // --- Mutative --- //

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

        for (uint256 i = 0; i < length; ++i) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = accountMargin.collaterals[synthMarketId];

            if (available == 0) {
                continue;
            }

            total += available;
            accountMargin.collaterals[synthMarketId] -= available;
            market.depositedCollateral[synthMarketId] -= available;

            // Withdraw all available collateral for this `synthMarketId`.
            withdrawAndTransfer(marketId, available, synthMarketId, globalConfig);
        }

        // No collateral has been withdrawn. Revert instead of noop.
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
        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Position is frozen due to prior flagged for liquidation.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 absAmountDelta = MathUtil.abs(amountDelta);
        uint256 totalMarketAvailableAmount = market.depositedCollateral[synthMarketId];

        Margin.CollateralType storage collateral = globalMarginConfig.supported[synthMarketId];

        // Prevent any operations if this synth isn't supported as collateral.
        if (!collateral.exists) {
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
            uint256 maxAllowable = collateral.maxAllowable;
            // Verify whether this will exceed the maximum allowable collateral amount.
            if (totalMarketAvailableAmount + absAmountDelta > maxAllowable) {
                revert ErrorUtil.MaxCollateralExceeded(absAmountDelta, maxAllowable);
            }
            accountMargin.collaterals[synthMarketId] += absAmountDelta;
            market.depositedCollateral[synthMarketId] += absAmountDelta;
            transferAndDeposit(marketId, absAmountDelta, synthMarketId, globalConfig);
        } else {
            // Verify the collateral previously associated to this account is enough to cover withdrawals.
            if (accountMargin.collaterals[synthMarketId] < absAmountDelta) {
                revert ErrorUtil.InsufficientCollateral(synthMarketId, totalMarketAvailableAmount, absAmountDelta);
            }

            accountMargin.collaterals[synthMarketId] -= absAmountDelta;
            market.depositedCollateral[synthMarketId] -= absAmountDelta;

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

    function isCollateralDeposited(uint128 synthMarketId) internal view returns (bool) {
        PerpMarket.GlobalData storage globalPerpMarket = PerpMarket.load();

        uint128[] memory activeMarketIds = globalPerpMarket.activeMarketIds;
        uint256 activeMarketIdsLength = activeMarketIds.length;
        // Accumulate collateral amounts for active markets
        for (uint256 i = 0; i < activeMarketIdsLength; ) {
            PerpMarket.Data storage market = PerpMarket.load(activeMarketIds[i]);

            if (market.depositedCollateral[synthMarketId] > 0) {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
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

        uint256 MAX_UINT256 = type(uint256).max;

        // Clear existing collateral configuration to be replaced with new.
        uint256 length0 = globalMarginConfig.supportedSynthMarketIds.length;
        for (uint256 i = 0; i < length0; ) {
            uint128 synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            delete globalMarginConfig.supported[synthMarketId];

            ITokenModule synth = synthMarketId == SYNTHETIX_USD_MARKET_ID
                ? ITokenModule(globalMarketConfig.usdToken)
                : ITokenModule(globalMarketConfig.spotMarket.getSynth(synthMarketId));

            synth.approve(address(globalMarketConfig.synthetix), 0);
            synth.approve(address(globalMarketConfig.spotMarket), 0);
            if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
                synth.approve(address(this), 0);
            }

            unchecked {
                ++i;
            }
        }

        uint128[] memory previousSupportedSynthMarketIds = globalMarginConfig.supportedSynthMarketIds;
        delete globalMarginConfig.supportedSynthMarketIds;

        // Update with passed in configuration.
        uint256 length1 = synthMarketIds.length;
        uint128[] memory newSupportedSynthMarketIds = new uint128[](length1);
        for (uint256 i = 0; i < length1; ) {
            uint128 synthMarketId = synthMarketIds[i];
            ITokenModule synth = synthMarketId == SYNTHETIX_USD_MARKET_ID
                ? ITokenModule(globalMarketConfig.usdToken)
                : ITokenModule(globalMarketConfig.spotMarket.getSynth(synthMarketId));

            // Perform approve _once_ when this collateral is added as a supported collateral.
            synth.approve(address(globalMarketConfig.synthetix), MAX_UINT256);
            synth.approve(address(globalMarketConfig.spotMarket), MAX_UINT256);
            if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
                synth.approve(address(this), MAX_UINT256);
            }

            globalMarginConfig.supported[synthMarketId] = Margin.CollateralType(maxAllowables[i], true);
            newSupportedSynthMarketIds[i] = synthMarketId;

            unchecked {
                ++i;
            }
        }
        globalMarginConfig.supportedSynthMarketIds = newSupportedSynthMarketIds;

        uint256 previousSupportedSynthMarketIdsLength = previousSupportedSynthMarketIds.length;
        for (uint i = 0; i < previousSupportedSynthMarketIdsLength; i++) {
            uint128 synthMarketId = previousSupportedSynthMarketIds[i];

            // If collateral deposited have deposits, but is not in the new collateral list, revert.
            // We do this to ensure that approvals for collateral in the system still exists.
            // Worth noting that market owner can still set maxAllowable to 0 to disable deposits for the collateral.
            if (isCollateralDeposited(synthMarketId) && !globalMarginConfig.supported[synthMarketId].exists) {
                revert ErrorUtil.MissingRequiredCollateral(synthMarketId);
            }

            unchecked {
                ++i;
            }
        }

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
                ++i;
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
