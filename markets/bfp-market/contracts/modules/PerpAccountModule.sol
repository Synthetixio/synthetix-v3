//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256, SafeCastI256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPerpAccountModule} from "../interfaces/IPerpAccountModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {AddressRegistry} from "../storage/AddressRegistry.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";

/* solhint-disable meta-transactions/no-msg-sender */

contract PerpAccountModule is IPerpAccountModule {
    using DecimalMath for uint256;
    using DecimalMath for uint128;
    using DecimalMath for int128;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using Margin for Margin.GlobalData;
    using Margin for Margin.Data;

    // --- Immutables --- //

    address immutable SYNTHETIX_CORE;
    address immutable SYNTHETIX_SUSD;
    address immutable ORACLE_MANAGER;

    constructor(address _synthetix) {
        SYNTHETIX_CORE = _synthetix;
        ISynthetixSystem core = ISynthetixSystem(_synthetix);
        SYNTHETIX_SUSD = address(core.getUsdToken());
        ORACLE_MANAGER = address(core.getOracleManager());

        if (
            _synthetix == address(0) || ORACLE_MANAGER == address(0) || SYNTHETIX_SUSD == address(0)
        ) {
            revert ErrorUtil.InvalidCoreAddress(_synthetix);
        }
    }

    // --- Runtime structs --- //

    struct Runtime_splitAccount {
        uint128 oraclePrice;
        uint128 toIm;
        uint128 fromIm;
        int128 sizeToMove;
        uint256 supportedCollateralsLength;
        address collateralAddress;
        uint128 collateralToMove;
        uint128 newFromAmountCollateral;
        uint128 fromAccountCollateral;
        uint128 toCollateralUsd;
        uint128 fromCollateralUsd;
        uint128 toDiscountedCollateralUsd;
        uint128 fromDiscountedCollateralUsd;
        uint128 collateralPrice;
        uint128 fromAccountCollateralUsd;
    }

    struct Runtime_mergeAccounts {
        uint128 oraclePrice;
        uint128 im;
        uint128 fromCollateralUsd;
        uint128 mergedCollateralUsd;
        uint128 mergedDiscountedCollateralUsd;
        uint128 fromAccountCollateral;
        uint256 supportedCollateralsLength;
        address collateralAddress;
    }

    // --- Helpers --- //

    /// @dev Realizes the account and position PnL.
    function realizeToAccountAndPosition(
        uint128 accountId,
        uint128 marketId,
        uint128 oraclePrice,
        uint128 entryPythPrice,
        PerpMarket.Data storage market,
        Margin.Data storage accountMargin,
        Margin.GlobalData storage globalMarginConfig,
        AddressRegistry.Data memory addresses
    ) internal returns (uint128) {
        uint128 collateralUsd = Margin.getCollateralUsdWithoutDiscount(
            Margin.load(accountId, marketId),
            globalMarginConfig,
            addresses
        );
        int128 pnlAdjustment = Margin.getPnlAdjustmentUsd(
            accountId,
            market,
            oraclePrice,
            entryPythPrice
        );
        uint128 marginUsd = MathUtil.max(collateralUsd.toInt() + pnlAdjustment, 0).toUint().to128();
        accountMargin.realizeAccountPnlAndUpdate(
            market,
            marginUsd.toInt() - collateralUsd.toInt(),
            addresses
        );

        return collateralUsd;
    }

    /// @inheritdoc IPerpAccountModule
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory) {
        Account.exists(accountId);
        PerpMarket.exists(marketId);

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedCollaterals.length;
        IPerpAccountModule.DepositedCollateral[]
            memory depositedCollaterals = new DepositedCollateral[](length);
        address collateralAddress;
        uint256 collateralPrice;

        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        for (uint256 i = 0; i < length; ) {
            collateralAddress = globalMarginConfig.supportedCollaterals[i];
            collateralPrice = globalMarginConfig.getCollateralPrice(collateralAddress, addresses);
            depositedCollaterals[i] = IPerpAccountModule.DepositedCollateral(
                collateralAddress,
                accountMargin.collaterals[collateralAddress],
                collateralPrice
            );

            unchecked {
                ++i;
            }
        }
        (uint256 collateralUsd, ) = Margin.getCollateralUsd(accountMargin, globalConfig, addresses);
        return
            IPerpAccountModule.AccountDigest(
                depositedCollaterals,
                collateralUsd,
                accountMargin.debtUsd,
                getPositionDigest(accountId, marketId)
            );
    }

    /// @inheritdoc IPerpAccountModule
    function getPositionDigest(
        uint128 accountId,
        uint128 marketId
    ) public view returns (IPerpAccountModule.PositionDigest memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        if (position.size == 0) {
            IPerpAccountModule.PositionDigest memory emptyPositionDigest;
            return emptyPositionDigest;
        }

        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        uint128 oraclePrice = market.getOraclePrice(addresses);
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice,
            addresses
        );

        Position.HealthData memory healthData = Position.getHealthData(
            market,
            position.size,
            position.entryPrice,
            position.entryFundingAccrued,
            position.entryUtilizationAccrued,
            oraclePrice,
            marketConfig,
            marginValues,
            addresses
        );
        (uint128 im, uint128 mm, ) = Position.getLiquidationMarginUsd(
            position.size,
            oraclePrice,
            marginValues.collateralUsd,
            marketConfig,
            addresses
        );

        return
            IPerpAccountModule.PositionDigest(
                accountId,
                marketId,
                marginValues.discountedMarginUsd,
                healthData.healthFactor,
                MathUtil.abs(position.size).mulDecimal(oraclePrice), // notionalValueUsd
                healthData.pnl,
                healthData.accruedFunding,
                healthData.accruedUtilization,
                position.entryPythPrice,
                position.entryPrice,
                oraclePrice,
                position.size,
                im,
                mm
            );
    }

    /// @inheritdoc IPerpAccountModule
    function splitAccount(
        uint128 fromId,
        uint128 toId,
        uint128 marketId,
        uint128 proportion
    ) external {
        FeatureFlag.ensureAccessToFeature(Flags.SPLIT_ACCOUNT);

        Account.loadAccountAndValidatePermission(
            fromId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );
        Account.loadAccountAndValidatePermission(
            toId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        if (toId == fromId) {
            revert ErrorUtil.DuplicateAccountIds();
        }

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.Data storage toAccountMargin = Margin.load(toId, marketId);
        Position.Data storage toPosition = market.positions[toId];
        Position.Data storage fromPosition = market.positions[fromId];

        // Cannot split more than what's available.
        if (proportion > DecimalMath.UNIT) {
            revert ErrorUtil.AccountSplitProportionTooLarge();
        }

        // Disallow no-ops.
        if (proportion == 0) {
            revert ErrorUtil.ZeroProportion();
        }

        // Ensure there are no pending orders from both to/from accounts.
        if (market.orders[toId].sizeDelta != 0 || market.orders[fromId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Account to split into must be empty.
        if (toPosition.size != 0) {
            revert ErrorUtil.PositionFound(toId, marketId);
        }

        // Can only split from an account that has a position.
        if (fromPosition.size == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        // `toId` account must be empty (i.e. no debt or collateral).
        if (Margin.hasCollateralDeposited(toId, marketId) || toAccountMargin.debtUsd != 0) {
            revert ErrorUtil.CollateralFound();
        }

        // Cannot split a position flagged for liquidation.
        if (market.flaggedLiquidations[fromId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        Runtime_splitAccount memory runtime;
        runtime.oraclePrice = market.getOraclePrice(addresses);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // `fromAccount` position should not be liquidatable.
        if (
            Position.isLiquidatable(
                fromPosition,
                runtime.oraclePrice,
                marketConfig,
                Margin.getMarginUsd(fromId, market, runtime.oraclePrice, addresses),
                addresses
            )
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        // Move collaterals `from` -> `to`.
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        runtime.supportedCollateralsLength = globalMarginConfig.supportedCollaterals.length;

        for (uint256 i = 0; i < runtime.supportedCollateralsLength; ) {
            runtime.collateralAddress = globalMarginConfig.supportedCollaterals[i];
            runtime.fromAccountCollateral = fromAccountMargin.collaterals[
                runtime.collateralAddress
            ];

            if (runtime.fromAccountCollateral > 0) {
                // Move available collateral `from` -> `to`.
                runtime.collateralToMove = runtime.fromAccountCollateral.mulDecimalUint128(
                    proportion
                );
                toAccountMargin.collaterals[runtime.collateralAddress] = runtime.collateralToMove;
                fromAccountMargin.collaterals[runtime.collateralAddress] -= runtime
                    .collateralToMove;
                runtime.collateralPrice = globalMarginConfig.getCollateralPrice(
                    runtime.collateralAddress,
                    addresses
                );

                runtime.fromAccountCollateralUsd = runtime.fromAccountCollateral.mulDecimalUint128(
                    runtime.collateralPrice
                );
                uint128 collateralToMoveUsd = runtime.collateralToMove.mulDecimalUint128(
                    runtime.collateralPrice
                );

                // Track both toCollateralUsd and toDiscountedCollateralUsd.
                runtime.toCollateralUsd += collateralToMoveUsd;
                runtime.toDiscountedCollateralUsd += runtime.collateralToMove.mulDecimalUint128(
                    Margin.getDiscountedCollateralPrice(
                        runtime.collateralToMove,
                        runtime.collateralPrice,
                        runtime.collateralAddress,
                        globalConfig,
                        globalMarginConfig,
                        addresses
                    )
                );

                // Track both fromCollateralUsd and fromCollateralDiscountedUsd.
                runtime.fromCollateralUsd += runtime.fromAccountCollateralUsd - collateralToMoveUsd;

                // Calculate the discounted price for the new from amount.
                runtime.newFromAmountCollateral =
                    runtime.fromAccountCollateral -
                    runtime.collateralToMove;
                runtime.fromDiscountedCollateralUsd += runtime
                    .newFromAmountCollateral
                    .mulDecimalUint128(
                        Margin.getDiscountedCollateralPrice(
                            runtime.newFromAmountCollateral,
                            runtime.collateralPrice,
                            runtime.collateralAddress,
                            globalConfig,
                            globalMarginConfig,
                            addresses
                        )
                    );
            }

            unchecked {
                ++i;
            }
        }

        // Move debt `from` -> `to`.
        if (fromAccountMargin.debtUsd > 0) {
            uint128 debtToMove = fromAccountMargin.debtUsd.mulDecimalUint128(proportion);
            toAccountMargin.debtUsd = debtToMove;
            fromAccountMargin.debtUsd -= debtToMove;
        }

        // Move size `from` -> `to`.
        runtime.sizeToMove = fromPosition.size.mulDecimalInt128(proportion.toInt());
        if (fromPosition.size < 0) {
            fromPosition.size += MathUtil.abs(runtime.sizeToMove).toInt().to128();
        } else {
            fromPosition.size -= runtime.sizeToMove;
        }

        toPosition.update(
            Position.Data({
                size: runtime.sizeToMove,
                entryFundingAccrued: fromPosition.entryFundingAccrued,
                entryUtilizationAccrued: fromPosition.entryUtilizationAccrued,
                entryPythPrice: fromPosition.entryPythPrice,
                entryPrice: fromPosition.entryPrice
            })
        );

        // Ensure `toAccount` has enough margin to meet IM.
        (runtime.toIm, , ) = Position.getLiquidationMarginUsd(
            toPosition.size,
            runtime.oraclePrice,
            runtime.toCollateralUsd,
            marketConfig,
            addresses
        );

        // `toRemainingMarginUsd` needs to be greater than or equal to IM.
        if (
            runtime.toDiscountedCollateralUsd.toInt() +
                Margin.getPnlAdjustmentUsd(toId, market, runtime.oraclePrice, runtime.oraclePrice) <
            runtime.toIm.toInt()
        ) {
            revert ErrorUtil.InsufficientMargin();
        }

        // Ensure we validate remaining `fromAccount` margin > IM when position still remains.
        if (proportion < DecimalMath.UNIT) {
            (runtime.fromIm, , ) = Position.getLiquidationMarginUsd(
                fromPosition.size,
                runtime.oraclePrice,
                runtime.fromCollateralUsd,
                marketConfig,
                addresses
            );

            // `fromRemainingMarginUsd` needs to be greater than or equal to IM.
            if (
                runtime.fromDiscountedCollateralUsd.toInt() +
                    Margin.getPnlAdjustmentUsd(
                        fromId,
                        market,
                        runtime.oraclePrice,
                        runtime.oraclePrice
                    ) <
                runtime.fromIm.toInt()
            ) {
                revert ErrorUtil.InsufficientMargin();
            }
        } else if (proportion == DecimalMath.UNIT) {
            // Clear out the `fromPosition` when the split is 1.
            delete market.positions[fromId];
        }

        emit AccountSplit(fromId, toId, marketId);
    }

    /// @inheritdoc IPerpAccountModule
    function mergeAccounts(uint128 fromId, uint128 toId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.MERGE_ACCOUNT);

        Account.exists(fromId);
        Account.exists(toId);

        // Cannot merge the same two accounts.
        if (toId == fromId) {
            revert ErrorUtil.DuplicateAccountIds();
        }

        Runtime_mergeAccounts memory runtime;

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);
        Margin.Data storage toAccountMargin = Margin.load(toId, marketId);
        Position.Data storage fromPosition = market.positions[fromId];
        Position.Data storage toPosition = market.positions[toId];
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        // Cannot merge when either accounts have an open order.
        if (market.orders[toId].sizeDelta != 0 || market.orders[fromId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Cannot merge unless accounts are on the same side.
        if (!MathUtil.sameSide(fromPosition.size, toPosition.size)) {
            revert ErrorUtil.InvalidPositionSide();
        }

        // Prevent flagged positions from merging.
        if (
            market.flaggedLiquidations[fromId] != address(0) ||
            market.flaggedLiquidations[toId] != address(0)
        ) {
            revert ErrorUtil.PositionFlagged();
        }

        // Only settlement hooks are allowed to merge accounts.
        if (!SettlementHookConfiguration.load().whitelisted[msg.sender]) {
            revert ErrorUtil.InvalidHook(msg.sender);
        }

        runtime.oraclePrice = market.getOraclePrice(addresses);

        Margin.MarginValues memory toMarginValues = Margin.getMarginUsd(
            toId,
            market,
            runtime.oraclePrice,
            addresses
        );

        // Prevent merging for `isLiquidatable` positions.
        if (
            Position.isLiquidatable(
                toPosition,
                runtime.oraclePrice,
                marketConfig,
                toMarginValues,
                addresses
            )
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        Margin.GlobalData storage globalMarginConfig = Margin.load();

        // Realize the position and account margin of both toId and fromId.
        runtime.fromCollateralUsd = realizeToAccountAndPosition(
            fromId,
            marketId,
            runtime.oraclePrice,
            fromPosition.entryPythPrice,
            market,
            fromAccountMargin,
            globalMarginConfig,
            addresses
        );
        realizeToAccountAndPosition(
            toId,
            marketId,
            runtime.oraclePrice,
            fromPosition.entryPythPrice,
            market,
            toAccountMargin,
            globalMarginConfig,
            addresses
        );

        runtime.supportedCollateralsLength = globalMarginConfig.supportedCollaterals.length;
        runtime.collateralAddress;
        runtime.fromAccountCollateral;

        for (uint256 i = 0; i < runtime.supportedCollateralsLength; ) {
            runtime.collateralAddress = globalMarginConfig.supportedCollaterals[i];
            runtime.fromAccountCollateral = fromAccountMargin.collaterals[
                runtime.collateralAddress
            ];
            if (runtime.fromAccountCollateral > 0) {
                // Move collateral `from` -> `to`.
                toAccountMargin.collaterals[runtime.collateralAddress] += runtime
                    .fromAccountCollateral;
                fromAccountMargin.collaterals[runtime.collateralAddress] = 0;
            }

            unchecked {
                ++i;
            }
        }

        // Move debt `from` -> `to`.
        toAccountMargin.debtUsd += fromAccountMargin.debtUsd;
        fromAccountMargin.debtUsd = 0;

        // Update debt correction for `from` position.
        market.updateDebtCorrection(
            fromPosition,
            Position.Data(
                0, // Zero because `from` position is deleted after merging.
                market.currentFundingAccruedComputed,
                market.currentUtilizationAccruedComputed,
                fromPosition.entryPythPrice,
                fromPosition.entryPythPrice
            )
        );

        Position.Data memory mergedPosition = Position.Data(
            toPosition.size + fromPosition.size,
            market.currentFundingAccruedComputed,
            market.currentUtilizationAccruedComputed,
            // Use the just settled fromAccount's raw Pyth price as both the entry and raw.
            fromPosition.entryPythPrice,
            fromPosition.entryPythPrice
        );

        // Update debt correction for `to` position.
        market.updateDebtCorrection(toPosition, mergedPosition);

        // Update position accounting `from` -> `to`.
        toPosition.update(mergedPosition);

        // Delete from position.
        delete market.positions[fromId];

        // Ensure the merged account meets IM requirements.
        (runtime.mergedCollateralUsd, runtime.mergedDiscountedCollateralUsd) = Margin
            .getCollateralUsd(
                Margin.load(toId, marketId),
                PerpMarketConfiguration.load(),
                addresses
            );
        (runtime.im, , ) = Position.getLiquidationMarginUsd(
            toPosition.size,
            runtime.oraclePrice,
            runtime.mergedCollateralUsd,
            marketConfig,
            addresses
        );

        // `mergedRemainingMarginUsd` should be greater than or equal to IM.
        if (
            runtime.mergedDiscountedCollateralUsd.toInt() +
                Margin.getPnlAdjustmentUsd(toId, market, runtime.oraclePrice, runtime.oraclePrice) <
            runtime.im.toInt()
        ) {
            revert ErrorUtil.InsufficientMargin();
        }

        emit AccountsMerged(fromId, toId, marketId);
    }
}
