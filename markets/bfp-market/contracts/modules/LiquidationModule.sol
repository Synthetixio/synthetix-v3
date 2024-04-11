//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ILiquidationModule} from "../interfaces/ILiquidationModule.sol";
import {IPerpRewardDistributor} from "../interfaces/IPerpRewardDistributor.sol";
import {Margin} from "../storage/Margin.sol";
import {Order} from "../storage/Order.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";

contract LiquidationModule is ILiquidationModule {
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Runtime structs --- //

    struct Runtime_liquidateCollateral {
        uint256 availableSusd;
        uint256 supportedSynthMarketIdsLength;
        uint128 synthMarketId;
        uint256 availableAccountCollateral;
        uint128 poolId;
        uint256 poolCollateralTypesLength;
    }

    // --- Helpers --- //

    /// @dev Before liquidation (not flag) to perform pre-steps and validation.
    function updateMarketPreLiquidation(
        uint128 accountId,
        uint128 marketId,
        PerpMarket.Data storage market,
        uint256 oraclePrice,
        PerpMarketConfiguration.GlobalData storage globalConfig
    )
        private
        returns (
            Position.Data storage oldPosition,
            Position.Data memory newPosition,
            uint256 liqKeeperFee
        )
    {
        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(
            marketId,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );

        uint128 liqSize;
        (oldPosition, newPosition, liqSize, liqKeeperFee) = Position.validateLiquidation(
            accountId,
            market,
            PerpMarketConfiguration.load(marketId),
            globalConfig
        );

        // Track the liqSize that is about to be liquidated.
        market.updateAccumulatedLiquidation(liqSize);

        // Update market to reflect state of liquidated position.
        uint128 updatedMarketSize = market.size - liqSize;
        int128 updatedMarketSkew = market.skew - oldPosition.size + newPosition.size;
        market.skew = updatedMarketSkew;
        market.size = updatedMarketSize;

        emit MarketSizeUpdated(marketId, updatedMarketSize, updatedMarketSkew);

        (uint256 utilizationRate, ) = market.recomputeUtilization(oraclePrice);
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);

        // Update market debt relative to the keeperFee incurred.
        market.updateDebtCorrection(market.positions[accountId], newPosition);
    }

    /// @dev Invoked post flag when position is dead and set to liquidate or when liquidating margin only due to debt.
    function liquidateCollateral(
        uint128 accountId,
        uint128 marketId,
        PerpMarket.Data storage market,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        Runtime_liquidateCollateral memory runtime;
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        runtime.availableSusd = accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID];

        // Clear out sUSD associated with the account of the liquidated position.
        if (runtime.availableSusd > 0) {
            market.depositedCollateral[SYNTHETIX_USD_MARKET_ID] -= runtime.availableSusd;
            accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] = 0;
        }
        // Clear out debt.
        if (accountMargin.debtUsd > 0) {
            market.totalTraderDebtUsd -= accountMargin.debtUsd;
            accountMargin.debtUsd = 0;
        }

        // For non-sUSD collateral, send to their respective reward distributor, create new distribution per collateral,
        // and then wipe out all associated collateral on the account.
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        runtime.supportedSynthMarketIdsLength = globalMarginConfig.supportedSynthMarketIds.length;

        // Iterate over all supported margin collateral types to see if any should be distributed to LPs.
        for (uint256 i = 0; i < runtime.supportedSynthMarketIdsLength; ) {
            runtime.synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            runtime.availableAccountCollateral = accountMargin.collaterals[runtime.synthMarketId];

            // Found a deposited collateral that must be distributed.
            if (runtime.availableAccountCollateral > 0) {
                address synth = globalConfig.spotMarket.getSynth(runtime.synthMarketId);
                globalConfig.synthetix.withdrawMarketCollateral(
                    marketId,
                    synth,
                    runtime.availableAccountCollateral
                );
                IPerpRewardDistributor distributor = IPerpRewardDistributor(
                    globalMarginConfig.supported[runtime.synthMarketId].rewardDistributor
                );
                ITokenModule(synth).transfer(
                    address(distributor),
                    runtime.availableAccountCollateral
                );

                runtime.poolId = distributor.getPoolId();
                address[] memory poolCollateralTypes = distributor.getPoolCollateralTypes();
                runtime.poolCollateralTypesLength = poolCollateralTypes.length;

                // Calculate the USD value of each collateral delegated to pool.
                uint256[] memory collateralValuesUsd = new uint256[](
                    runtime.poolCollateralTypesLength
                );
                uint256 totalCollateralValueUsd;
                for (uint256 j = 0; j < runtime.poolCollateralTypesLength; ) {
                    (, uint256 collateralValueUsd) = globalConfig.synthetix.getVaultCollateral(
                        runtime.poolId,
                        poolCollateralTypes[j]
                    );
                    totalCollateralValueUsd += collateralValueUsd;
                    collateralValuesUsd[j] = collateralValueUsd;

                    unchecked {
                        ++j;
                    }
                }

                // Infer the ratio of size to distribute, proportional to value of each delegated collateral.
                uint256 remainingAmountToDistribute = runtime.availableAccountCollateral;
                for (uint256 k = 0; k < runtime.poolCollateralTypesLength; ) {
                    // Ensure total amounts fully distributed, the last collateral receives the remainder.
                    if (k == runtime.poolCollateralTypesLength - 1) {
                        distributor.distributeRewards(
                            poolCollateralTypes[k],
                            remainingAmountToDistribute
                        );
                    } else {
                        uint256 amountToDistribute = runtime.availableAccountCollateral.mulDecimal(
                            collateralValuesUsd[k].divDecimal(totalCollateralValueUsd)
                        );
                        remainingAmountToDistribute -= amountToDistribute;
                        distributor.distributeRewards(poolCollateralTypes[k], amountToDistribute);
                    }

                    unchecked {
                        ++k;
                    }
                }

                // Clear out non-sUSD collateral associated with the account of the liquidated position.
                market.depositedCollateral[runtime.synthMarketId] -= runtime
                    .availableAccountCollateral;
                accountMargin.collaterals[runtime.synthMarketId] = 0;
            }

            unchecked {
                ++i;
            }
        }
    }

    // --- Mutations --- //

    /// @inheritdoc ILiquidationModule
    function flagPosition(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.FLAG_POSITION);

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        // Cannot reflag an account that's already flagged.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        int128 size = position.size;

        // Cannot flag a position that does not exist.
        if (size == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        uint256 oraclePrice = market.getOraclePrice();
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice
        );

        // Cannot flag for liquidation unless they are liquidatable.
        bool isLiquidatable = position.isLiquidatable(
            market,
            oraclePrice,
            PerpMarketConfiguration.load(marketId),
            marginValues
        );
        if (!isLiquidatable) {
            revert ErrorUtil.CannotLiquidatePosition();
        }

        // Remove any pending orders that may exist.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            emit OrderCanceled(accountId, marketId, 0, order.commitmentTime);
            delete market.orders[accountId];
        }
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint256 ethPrice = globalConfig
            .oracleManager
            .process(globalConfig.ethOracleNodeId)
            .price
            .toUint();
        uint256 flagReward = Position.getLiquidationFlagReward(
            MathUtil.abs(size).mulDecimal(oraclePrice),
            marginValues.collateralUsd,
            ethPrice,
            PerpMarketConfiguration.load(marketId),
            globalConfig
        );

        liquidateCollateral(accountId, marketId, market, globalConfig);

        address msgSender = ERC2771Context._msgSender();

        // Flag and emit event.
        market.flaggedLiquidations[accountId] = msgSender;

        // Pay flagger.
        globalConfig.synthetix.withdrawMarketUsd(marketId, msgSender, flagReward);

        emit PositionFlaggedLiquidation(accountId, marketId, msgSender, flagReward, oraclePrice);
    }

    /// @inheritdoc ILiquidationModule
    function liquidatePosition(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.LIQUIDATE_POSITION);

        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        // Cannot liquidate a position that does not exist.
        if (position.size == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        uint256 oraclePrice = market.getOraclePrice();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        address flagger = market.flaggedLiquidations[accountId];
        (, Position.Data memory newPosition, uint256 liqKeeperFee) = updateMarketPreLiquidation(
            accountId,
            marketId,
            market,
            oraclePrice,
            globalConfig
        );

        int128 oldPositionSize = position.size;
        if (newPosition.size == 0) {
            delete market.positions[accountId];
            delete market.flaggedLiquidations[accountId];
        } else {
            market.positions[accountId].update(newPosition);
        }

        address msgSender = ERC2771Context._msgSender();

        // Pay the keeper
        globalConfig.synthetix.withdrawMarketUsd(marketId, msgSender, liqKeeperFee);

        emit PositionLiquidated(
            accountId,
            marketId,
            oldPositionSize,
            newPosition.size,
            msgSender,
            flagger,
            liqKeeperFee,
            oraclePrice
        );
    }

    /// @dev Returns the reward for liquidating margin.
    function getMarginLiquidationOnlyReward(
        uint256 collateralValue,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        uint256 ethPrice = globalConfig
            .oracleManager
            .process(globalConfig.ethOracleNodeId)
            .price
            .toUint();
        uint256 liqExecutionCostInUsd = ethPrice.mulDecimal(
            block.basefee * globalConfig.keeperLiquidateMarginGasUnits
        );

        uint256 liqFeeInUsd = MathUtil.max(
            liqExecutionCostInUsd.mulDecimal(
                DecimalMath.UNIT + globalConfig.keeperProfitMarginPercent
            ),
            liqExecutionCostInUsd + globalConfig.keeperProfitMarginUsd
        );
        uint256 liqFeeWithRewardInUsd = liqFeeInUsd +
            collateralValue.mulDecimal(marketConfig.liquidationRewardPercent);

        return MathUtil.min(liqFeeWithRewardInUsd, globalConfig.maxKeeperFeeUsd);
    }

    /// @inheritdoc ILiquidationModule
    function liquidateMarginOnly(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.LIQUIDATE_MARGIN_ONLY);

        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        uint256 oraclePrice = market.getOraclePrice();

        if (!Margin.isMarginLiquidatable(accountId, market, oraclePrice)) {
            revert ErrorUtil.CannotLiquidateMargin();
        }

        // Remove any pending orders that may exist.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            emit OrderCanceled(accountId, marketId, 0, order.commitmentTime);
            delete market.orders[accountId];
        }

        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice
        );

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        uint256 keeperReward = getMarginLiquidationOnlyReward(
            marginValues.collateralUsd,
            PerpMarketConfiguration.load(marketId),
            globalConfig
        );

        liquidateCollateral(accountId, marketId, market, PerpMarketConfiguration.load());

        // Pay the caller.
        globalConfig.synthetix.withdrawMarketUsd(
            marketId,
            ERC2771Context._msgSender(),
            keeperReward
        );

        emit MarginLiquidated(accountId, marketId, keeperReward);
    }

    // --- Views --- //

    /// @inheritdoc ILiquidationModule
    function getLiquidationFees(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256 flagKeeperReward, uint256 liqKeeperFee) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        uint256 absSize = MathUtil.abs(market.positions[accountId].size);

        // Return empty when a position does not exist.
        if (absSize == 0) {
            return (0, 0);
        }
        uint256 oraclePrice = market.getOraclePrice();
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice
        );
        uint256 ethPrice = globalConfig
            .oracleManager
            .process(globalConfig.ethOracleNodeId)
            .price
            .toUint();

        flagKeeperReward = Position.getLiquidationFlagReward(
            absSize.mulDecimal(oraclePrice),
            marginValues.collateralUsd,
            ethPrice,
            marketConfig,
            globalConfig
        );
        liqKeeperFee = Position.getLiquidationKeeperFee(
            absSize.to128(),
            ethPrice,
            marketConfig,
            globalConfig
        );
    }

    /// @inheritdoc ILiquidationModule
    function getRemainingLiquidatableSizeCapacity(
        uint128 marketId
    )
        external
        view
        returns (
            uint128 maxLiquidatableCapacity,
            uint128 remainingCapacity,
            uint128 lastLiquidationTimestamp
        )
    {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.getRemainingLiquidatableSizeCapacity(PerpMarketConfiguration.load(marketId));
    }

    /// @inheritdoc ILiquidationModule
    function isPositionLiquidatable(
        uint128 accountId,
        uint128 marketId
    ) external view returns (bool) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        uint256 oraclePrice = market.getOraclePrice();

        return
            market.positions[accountId].isLiquidatable(
                market,
                oraclePrice,
                PerpMarketConfiguration.load(marketId),
                Margin.getMarginUsd(accountId, market, oraclePrice)
            );
    }

    /// @inheritdoc ILiquidationModule
    function isMarginLiquidatable(
        uint128 accountId,
        uint128 marketId
    ) external view returns (bool) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return Margin.isMarginLiquidatable(accountId, market, market.getOraclePrice());
    }

    /// @inheritdoc ILiquidationModule
    function getLiquidationMarginUsd(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta
    ) external view returns (uint256 im, uint256 mm) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Account.exists(accountId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        uint256 oraclePrice = market.getOraclePrice();

        (im, mm, ) = Position.getLiquidationMarginUsd(
            market.positions[accountId].size + sizeDelta,
            oraclePrice,
            Margin.getMarginUsd(accountId, market, oraclePrice).collateralUsd,
            marketConfig
        );
    }

    /// @inheritdoc ILiquidationModule
    function getHealthFactor(uint128 accountId, uint128 marketId) external view returns (uint256) {
        Account.exists(accountId);

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        uint256 oraclePrice = market.getOraclePrice();

        Position.HealthData memory healthData = Position.getHealthData(
            market,
            position.size,
            position.entryPrice,
            position.entryFundingAccrued,
            position.entryUtilizationAccrued,
            oraclePrice,
            PerpMarketConfiguration.load(marketId),
            Margin.getMarginUsd(accountId, market, oraclePrice)
        );
        return healthData.healthFactor;
    }
}
