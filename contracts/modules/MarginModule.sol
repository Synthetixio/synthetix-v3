//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IMarginModule} from "../interfaces/IMarginModule.sol";
import {Order} from "../storage/Order.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {Flags} from "../utils/Flags.sol";

contract MarginModule is IMarginModule {
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using Margin for Margin.GlobalData;

    // --- Runtime structs --- //

    struct Runtime_setCollateralConfiguration {
        uint256 lengthBefore;
        uint256 lengthAfter;
        uint256 maxApproveAmount;
        uint128[] previousSupportedSynthMarketIds;
    }

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

        // We use the haircut adjusted price here due to the explicit liquidation check.
        uint256 marginUsd = Margin.getMarginUsd(accountId, market, oraclePrice, true /* useHaircutCollateralPrice */);

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
     * @dev Performs a collateral withdraw from Synthetix, ERC20 transfer, and emits event.
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

    /**
     * @dev Invokes `approve` on synth by their marketId with `amount` for core contracts.
     */
    function approveSynthCollateral(
        uint128 synthMarketId,
        uint256 amount,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        ITokenModule synth = synthMarketId == SYNTHETIX_USD_MARKET_ID
            ? ITokenModule(globalConfig.usdToken)
            : ITokenModule(globalConfig.spotMarket.getSynth(synthMarketId));

        synth.approve(address(globalConfig.synthetix), amount);
        synth.approve(address(globalConfig.spotMarket), amount);
        if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
            synth.approve(address(this), amount);
        }
    }

    /**
     * @dev Given a `synthMarketId` determine if tokens of collateral has been deposited in any market.
     */
    function isCollateralDeposited(uint128 synthMarketId) private view returns (bool) {
        PerpMarket.GlobalData storage globalPerpMarket = PerpMarket.load();

        uint128[] memory activeMarketIds = globalPerpMarket.activeMarketIds;
        uint256 activeMarketIdsLength = activeMarketIds.length;

        // In practice, we should only have one perp market but this has been designed to allow for many. So,
        // we should consider that possibility and iterate over all active markets.
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

    // --- Mutative --- //

    /**
     * @inheritdoc IMarginModule
     */
    function withdrawAllCollateral(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.WITHDRAW);
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        // Prevent collateral transfers when there's a pending order.
        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Position is frozen due to prior flagged for liquidation.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        // Prevent withdraw all transfers when there's an open position.
        Position.Data storage position = market.positions[accountId];
        if (position.size != 0) {
            revert ErrorUtil.PositionFound(accountId, marketId);
        }
        uint256 oraclePrice = market.getOraclePrice();
        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.getCurrentFundingVelocity());

        (uint256 utilizationRate, ) = market.recomputeUtilization(oraclePrice);
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);

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

            // All collateral withdrawn from `accountMargin`, can be set directly to zero.
            accountMargin.collaterals[synthMarketId] = 0;

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
        // Revert on zero amount operations rather than no-op.
        if (amountDelta == 0) {
            revert ErrorUtil.ZeroAmount();
        }

        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION);

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.CollateralType storage collateral = globalMarginConfig.supported[synthMarketId];

        // Prevent any operations if this synth isn't supported as collateral.
        if (!collateral.exists) {
            revert ErrorUtil.UnsupportedCollateral(synthMarketId);
        }

        // Prevent collateral transfers when there's a pending order.
        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Position is frozen due to prior flagged for liquidation.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        uint256 absAmountDelta = MathUtil.abs(amountDelta);

        uint256 oraclePrice = market.getOraclePrice();
        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.getCurrentFundingVelocity());

        (uint256 utilizationRate, ) = market.recomputeUtilization(oraclePrice);
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);

        // > 0 is a deposit whilst < 0 is a withdrawal.
        if (amountDelta > 0) {
            FeatureFlag.ensureAccessToFeature(Flags.DEPOSIT);
            uint256 maxAllowable = collateral.maxAllowable;
            uint256 totalMarketAvailableAmount = market.depositedCollateral[synthMarketId];

            // Verify whether this will exceed the maximum allowable collateral amount.
            if (totalMarketAvailableAmount + absAmountDelta > maxAllowable) {
                revert ErrorUtil.MaxCollateralExceeded(absAmountDelta, maxAllowable);
            }
            accountMargin.collaterals[synthMarketId] += absAmountDelta;
            market.depositedCollateral[synthMarketId] += absAmountDelta;
            transferAndDeposit(marketId, absAmountDelta, synthMarketId, globalConfig);
        } else {
            FeatureFlag.ensureAccessToFeature(Flags.WITHDRAW);
            // Verify the collateral previously associated to this account is enough to cover withdrawals.
            if (accountMargin.collaterals[synthMarketId] < absAmountDelta) {
                revert ErrorUtil.InsufficientCollateral(
                    synthMarketId,
                    accountMargin.collaterals[synthMarketId],
                    absAmountDelta
                );
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

    /**
     * @inheritdoc IMarginModule
     */
    function setCollateralMaxAllowable(uint128 synthMarketId, uint128 maxAllowable) external {
        OwnableStorage.onlyOwner();

        Margin.GlobalData storage globalMarginConfig = Margin.load();
        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        for (uint256 i = 0; i < length; ) {
            uint128 currentSynthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            if (currentSynthMarketId == synthMarketId) {
                globalMarginConfig.supported[currentSynthMarketId].maxAllowable = maxAllowable;
                return;
            }
            unchecked {
                ++i;
            }
        }
        revert ErrorUtil.UnsupportedCollateral(synthMarketId);
    }

    /**
     * @inheritdoc IMarginModule
     */
    function setCollateralConfiguration(
        uint128[] calldata synthMarketIds,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables,
        address[] calldata rewardDistributors
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        Runtime_setCollateralConfiguration memory runtime;
        runtime.lengthBefore = globalMarginConfig.supportedSynthMarketIds.length;
        runtime.lengthAfter = synthMarketIds.length;
        runtime.maxApproveAmount = type(uint256).max;
        runtime.previousSupportedSynthMarketIds = globalMarginConfig.supportedSynthMarketIds;

        // Ensure all supplied arrays have the same length.
        if (
            oracleNodeIds.length != runtime.lengthAfter ||
            maxAllowables.length != runtime.lengthAfter ||
            rewardDistributors.length != runtime.lengthAfter
        ) {
            revert ErrorUtil.ArrayLengthMismatch();
        }

        // Clear existing collateral configuration to be replaced with new.
        for (uint256 i = 0; i < runtime.lengthBefore; ) {
            uint128 synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            delete globalMarginConfig.supported[synthMarketId];

            approveSynthCollateral(synthMarketId, 0, globalMarketConfig);

            unchecked {
                ++i;
            }
        }
        delete globalMarginConfig.supportedSynthMarketIds;

        // Update with passed in configuration.
        uint128[] memory newSupportedSynthMarketIds = new uint128[](runtime.lengthAfter);
        for (uint256 i = 0; i < runtime.lengthAfter; ) {
            uint128 synthMarketId = synthMarketIds[i];

            // Perform approve _once_ when this collateral is added as a supported collateral.
            approveSynthCollateral(synthMarketId, runtime.maxApproveAmount, globalMarketConfig);

            // Non sUSD collaterals must have a rewards distributor.
            if (synthMarketId != SYNTHETIX_USD_MARKET_ID && rewardDistributors[i] == address(0)) {
                revert ErrorUtil.ZeroAddress();
            }

            globalMarginConfig.supported[synthMarketId] = Margin.CollateralType(
                oracleNodeIds[i],
                maxAllowables[i],
                rewardDistributors[i],
                true
            );
            newSupportedSynthMarketIds[i] = synthMarketId;

            unchecked {
                ++i;
            }
        }
        globalMarginConfig.supportedSynthMarketIds = newSupportedSynthMarketIds;

        for (uint i = 0; i < runtime.lengthBefore; ) {
            uint128 synthMarketId = runtime.previousSupportedSynthMarketIds[i];

            // Removing a collateral with a non-zero deposit amount is _not_ allowed. To wind down a collateral,
            // the market owner can set `maxAllowable=0` to disable deposits but to ensure traders can always withdraw
            // their deposited collateral, we cannot remove the collateral if deposits still remain.
            if (isCollateralDeposited(synthMarketId) && !globalMarginConfig.supported[synthMarketId].exists) {
                revert ErrorUtil.MissingRequiredCollateral(synthMarketId);
            }

            unchecked {
                ++i;
            }
        }

        emit CollateralConfigured(msg.sender, runtime.lengthAfter);
    }

    // --- Views --- //

    /**
     * @inheritdoc IMarginModule
     */
    function getConfiguredCollaterals() external view returns (ConfiguredCollateral[] memory) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        MarginModule.ConfiguredCollateral[] memory collaterals = new ConfiguredCollateral[](length);
        uint128 synthMarketId;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            Margin.CollateralType storage c = globalMarginConfig.supported[synthMarketId];
            collaterals[i] = ConfiguredCollateral(synthMarketId, c.oracleNodeId, c.maxAllowable, c.rewardDistributor);

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
        return Margin.getCollateralUsd(accountId, marketId, false /* useHaircutCollateralPrice */);
    }

    /**
     * @inheritdoc IMarginModule
     */
    function getMarginUsd(uint128 accountId, uint128 marketId) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return Margin.getMarginUsd(accountId, market, market.getOraclePrice(), false /* useHaircutCollateralPrice */);
    }

    /**
     * @inheritdoc IMarginModule
     */
    function getHaircutCollateralPrice(uint128 synthMarketId, int256 size) external view returns (uint256) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration.load();
        return globalMarginConfig.getHaircutCollateralPrice(synthMarketId, MathUtil.abs(size), globalMarketConfig);
    }
}
