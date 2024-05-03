//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IMarginModule} from "../interfaces/IMarginModule.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";

contract MarginModule is IMarginModule {
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using Margin for Margin.GlobalData;
    using Margin for Margin.Data;

    // --- Constants --- //

    uint256 private constant MAX_SUPPORTED_MARGIN_COLLATERALS = 10;

    // --- Runtime structs --- //

    struct Runtime_setMarginCollateralConfiguration {
        uint256 lengthBefore;
        uint256 lengthAfter;
        uint256 maxApproveAmount;
        uint128[] previousSupportedSynthMarketIds;
    }

    // --- Helpers --- //

    /// @dev Validation account and position after accounting update to verify margin requirements are acceptable.
    function validateAccountAndPositionOnWithdrawal(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.Data storage position,
        uint256 oraclePrice
    ) private view {
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice
        );

        // Make sure margin isn't liquidatable due to debt.
        if (Margin.isMarginLiquidatable(accountId, market, marginValues)) {
            revert ErrorUtil.InsufficientMargin();
        }

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(market.id);

        // Ensure does not lead to instant liquidation.
        if (position.isLiquidatable(market, oraclePrice, marketConfig, marginValues)) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        (uint256 im, , ) = Position.getLiquidationMarginUsd(
            position.size,
            oraclePrice,
            marginValues.collateralUsd,
            marketConfig
        );

        // We use the discount adjusted price here due to the explicit liquidation check.
        if (marginValues.discountedMarginUsd < im) {
            revert ErrorUtil.InsufficientMargin();
        }
    }

    /// @dev Performs a collateral withdraw from Synthetix, ERC20 transfer, and emits event.
    function withdrawAndTransfer(
        uint128 marketId,
        uint256 amount,
        uint128 synthMarketId,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        address msgSender = ERC2771Context._msgSender();
        if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
            globalConfig.synthetix.withdrawMarketUsd(marketId, msgSender, amount);
        } else {
            ITokenModule synth = ITokenModule(globalConfig.spotMarket.getSynth(synthMarketId));
            globalConfig.synthetix.withdrawMarketCollateral(marketId, address(synth), amount);
            synth.transfer(msgSender, amount);
        }
        emit MarginWithdraw(address(this), msgSender, amount, synthMarketId);
    }

    /// @dev Performs an ERC20 transfer, deposits collateral to Synthetix, and emits event.
    function transferAndDeposit(
        uint128 marketId,
        uint256 amount,
        uint128 synthMarketId,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        address msgSender = ERC2771Context._msgSender();
        if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
            globalConfig.synthetix.depositMarketUsd(marketId, msgSender, amount);
        } else {
            ITokenModule synth = ITokenModule(globalConfig.spotMarket.getSynth(synthMarketId));
            synth.transferFrom(msgSender, address(this), amount);
            globalConfig.synthetix.depositMarketCollateral(marketId, address(synth), amount);
        }
        emit MarginDeposit(msgSender, address(this), amount, synthMarketId);
    }

    /// @dev Invokes `approve` on synth by their marketId with `amount` for core contracts.
    function approveSynthCollateral(
        uint128 synthMarketId,
        uint256 amount,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        ITokenModule synth = synthMarketId == SYNTHETIX_USD_MARKET_ID
            ? ITokenModule(globalConfig.usdToken)
            : ITokenModule(globalConfig.spotMarket.getSynth(synthMarketId));
        synth.approve(address(globalConfig.synthetix), amount);
    }

    /// @dev Given a `synthMarketId` determine if tokens of collateral has been deposited in any market.
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

    // --- Mutations --- //

    /// @inheritdoc IMarginModule
    function withdrawAllCollateral(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.WITHDRAW);
        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        PerpMarket.Data storage market = PerpMarket.exists(marketId);

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

        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        // Prevent withdraw all when there is unpaid debt owned on the account margin.
        if (accountMargin.debtUsd != 0) {
            revert ErrorUtil.DebtFound(accountId, marketId);
        }

        uint256 oraclePrice = market.getOraclePrice();
        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(
            marketId,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );

        (uint256 utilizationRate, ) = market.recomputeUtilization(oraclePrice);
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);

        Margin.GlobalData storage globalMarginConfig = Margin.load();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

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

    /// @inheritdoc IMarginModule
    function modifyCollateral(
        uint128 accountId,
        uint128 marketId,
        uint128 synthMarketId,
        int256 amountDelta
    ) external {
        // Revert on zero amount operations rather than no-op.
        if (amountDelta == 0) {
            revert ErrorUtil.ZeroAmount();
        }

        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

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
        emit FundingRecomputed(
            marketId,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );

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

            // Verify account and position remain solvent.
            Position.Data storage position = market.positions[accountId];
            if (position.size != 0 || accountMargin.debtUsd != 0) {
                validateAccountAndPositionOnWithdrawal(accountId, market, position, oraclePrice);
            }

            // Perform the actual withdraw & transfer from Synthetix Core to msg.sender.
            withdrawAndTransfer(marketId, absAmountDelta, synthMarketId, globalConfig);
        }
    }

    /// @inheritdoc IMarginModule
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

    /// @inheritdoc IMarginModule
    function setMarginCollateralConfiguration(
        uint128[] calldata synthMarketIds,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables,
        address[] calldata rewardDistributors
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration
            .load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        Runtime_setMarginCollateralConfiguration memory runtime;
        runtime.lengthBefore = globalMarginConfig.supportedSynthMarketIds.length;
        runtime.lengthAfter = synthMarketIds.length;
        runtime.maxApproveAmount = type(uint256).max;
        runtime.previousSupportedSynthMarketIds = globalMarginConfig.supportedSynthMarketIds;

        // Number of synth collaterals to configure exceeds system maxmium.
        if (runtime.lengthAfter > MAX_SUPPORTED_MARGIN_COLLATERALS) {
            revert ErrorUtil.MaxCollateralExceeded(
                runtime.lengthAfter,
                MAX_SUPPORTED_MARGIN_COLLATERALS
            );
        }

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

            // sUSD must have a 0x0 reward distributor.
            address distributor = rewardDistributors[i];
            if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
                if (distributor != address(0)) {
                    revert ErrorUtil.InvalidRewardDistributor(distributor);
                }
            } else {
                // non-sUSD collateral must have a compatible reward distributor.
                //
                // NOTE: The comparison with `IRewardDistributor` here and not `IPerpRewardDistributor`.
                if (
                    !ERC165Helper.safeSupportsInterface(
                        distributor,
                        type(IRewardDistributor).interfaceId
                    )
                ) {
                    revert ErrorUtil.InvalidRewardDistributor(distributor);
                }
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

        for (uint256 i = 0; i < runtime.lengthBefore; ) {
            uint128 synthMarketId = runtime.previousSupportedSynthMarketIds[i];

            // Removing a collateral with a non-zero deposit amount is _not_ allowed. To wind down a collateral,
            // the market owner can set `maxAllowable=0` to disable deposits but to ensure traders can always withdraw
            // their deposited collateral, we cannot remove the collateral if deposits still remain.
            if (
                isCollateralDeposited(synthMarketId) &&
                !globalMarginConfig.supported[synthMarketId].exists
            ) {
                revert ErrorUtil.MissingRequiredCollateral(synthMarketId);
            }

            unchecked {
                ++i;
            }
        }

        emit MarginCollateralConfigured(ERC2771Context._msgSender(), runtime.lengthAfter);
    }

    /// @inheritdoc IMarginModule
    function payDebt(uint128 accountId, uint128 marketId, uint128 amount) external {
        FeatureFlag.ensureAccessToFeature(Flags.PAY_DEBT);
        if (amount == 0) {
            revert ErrorUtil.ZeroAmount();
        }

        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        // We're storing debt separately to track the current debt before we pay down.
        uint128 debt = accountMargin.debtUsd;
        if (debt == 0) {
            revert ErrorUtil.NoDebt();
        }
        uint128 decreaseDebtAmount = MathUtil.min(amount, debt).to128();
        uint128 availableSusd = accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID].to128();

        // Infer the amount of sUSD to deduct from margin.
        uint128 sUsdToDeduct = 0;
        if (availableSusd != 0) {
            sUsdToDeduct = MathUtil.min(decreaseDebtAmount, availableSusd).to128();
            accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] -= sUsdToDeduct;
        }

        // Perform account and margin debt updates.
        accountMargin.debtUsd -= decreaseDebtAmount;
        market.updateDebtAndCollateral(-decreaseDebtAmount.toInt(), -sUsdToDeduct.toInt());

        // Infer the remaining sUSD to burn from `ERC2771Context._msgSender()` after attributing sUSD in margin.
        uint128 amountToBurn = decreaseDebtAmount - sUsdToDeduct;
        if (amountToBurn > 0) {
            globalConfig.synthetix.depositMarketUsd(
                marketId,
                ERC2771Context._msgSender(),
                amountToBurn
            );
        }

        emit DebtPaid(accountId, marketId, debt, accountMargin.debtUsd, sUsdToDeduct);
    }

    // --- Views --- //

    /// @inheritdoc IMarginModule
    function getMarginCollateralConfiguration()
        external
        view
        returns (ConfiguredCollateral[] memory)
    {
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        MarginModule.ConfiguredCollateral[] memory collaterals = new ConfiguredCollateral[](length);
        uint128 synthMarketId;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            Margin.CollateralType storage c = globalMarginConfig.supported[synthMarketId];
            collaterals[i] = ConfiguredCollateral(
                synthMarketId,
                c.oracleNodeId,
                c.maxAllowable,
                c.rewardDistributor
            );

            unchecked {
                ++i;
            }
        }

        return collaterals;
    }

    /// @inheritdoc IMarginModule
    function getMarginDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (Margin.MarginValues memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return Margin.getMarginUsd(accountId, market, market.getOraclePrice());
    }

    /// @inheritdoc IMarginModule
    function getNetAssetValue(
        uint128 accountId,
        uint128 marketId,
        uint256 oraclePrice
    ) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return
            Margin.getNetAssetValue(
                accountId,
                market,
                oraclePrice == 0 ? market.getOraclePrice() : oraclePrice
            );
    }

    /// @inheritdoc IMarginModule
    function getDiscountedCollateralPrice(
        uint128 synthMarketId,
        uint256 amount
    ) external view returns (uint256) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration
            .load();

        return
            Margin.getDiscountedCollateralPrice(
                amount,
                globalMarginConfig.getCollateralPrice(synthMarketId, globalMarketConfig),
                synthMarketId,
                globalMarketConfig
            );
    }

    /// @inheritdoc IMarginModule
    function getWithdrawableMargin(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        uint256 oraclePrice = market.getOraclePrice();
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice
        );
        Position.Data storage position = market.positions[accountId];
        int128 size = position.size;

        // When there is no position then we can ignore all running losses/profits but still need to include debt
        // as they may have realized a prior negative PnL.
        if (size == 0) {
            return
                MathUtil.max(
                    marginValues.collateralUsd - Margin.load(accountId, marketId).debtUsd,
                    0
                );
        }

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        (uint256 im, , ) = Position.getLiquidationMarginUsd(
            size,
            oraclePrice,
            marginValues.collateralUsd,
            marketConfig
        );

        // There is a position open. Discount the collateral, deduct running losses (or add profits), reduce
        // by the IM as well as the liq and flag fee for an approximate withdrawable margin. We call this approx
        // because both the liq and flag rewards can change based on chain usage.
        return MathUtil.max(marginValues.discountedMarginUsd.toInt() - im.toInt(), 0).toUint();
    }

    /// @inheritdoc IMarginModule
    function getMarginLiquidationOnlyReward(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.exists(marketId);

        return
            Margin.getMarginLiquidationOnlyReward(
                Margin.getCollateralUsdWithoutDiscount(accountId, marketId),
                PerpMarketConfiguration.load(marketId),
                PerpMarketConfiguration.load()
            );
    }
}
