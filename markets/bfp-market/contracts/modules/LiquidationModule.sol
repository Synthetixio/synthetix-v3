//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ILiquidationModule} from "../interfaces/ILiquidationModule.sol";
import {IPerpRewardDistributor} from "../interfaces/IPerpRewardDistributor.sol";
import {Margin} from "../storage/Margin.sol";
import {Order} from "../storage/Order.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {AddressRegistry} from "../storage/AddressRegistry.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";

contract LiquidationModule is ILiquidationModule {
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

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

    struct Runtime_liquidateCollateral {
        uint256 availableSusd;
        uint256 supportedCollateralsLength;
        address collateralAddress;
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
        (int128 fundingRate, ) = market.recomputeFunding(oraclePrice);
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
            globalConfig,
            ORACLE_MANAGER
        );

        // Track the liqSize that is about to be liquidated.
        market.updateAccumulatedLiquidation(liqSize);

        // Update market to reflect state of liquidated position.
        uint128 updatedMarketSize = market.size - liqSize;
        int128 updatedMarketSkew = market.skew - oldPosition.size + newPosition.size;
        market.skew = updatedMarketSkew;
        market.size = updatedMarketSize;

        emit MarketSizeUpdated(marketId, updatedMarketSize, updatedMarketSkew);

        (uint128 utilizationRate, ) = market.recomputeUtilization(
            oraclePrice,
            AddressRegistry.Data({
                synthetix: ISynthetixSystem(SYNTHETIX_CORE),
                sUsd: SYNTHETIX_SUSD,
                oracleManager: ORACLE_MANAGER
            })
        );
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);

        // Update market debt relative to the keeperFee incurred.
        market.updateDebtCorrection(oldPosition, newPosition);
    }

    /// @dev Invoked post flag when position is dead and set to liquidate or when liquidating margin only due to debt.
    function liquidateCollateral(
        uint128 accountId,
        uint128 marketId,
        PerpMarket.Data storage market
    ) private {
        Runtime_liquidateCollateral memory runtime;
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        runtime.availableSusd = accountMargin.collaterals[SYNTHETIX_SUSD];

        // Clear out sUSD associated with the account of the liquidated position.
        if (runtime.availableSusd > 0) {
            market.depositedCollateral[SYNTHETIX_SUSD] -= runtime.availableSusd;
            accountMargin.collaterals[SYNTHETIX_SUSD] = 0;
        }
        // Clear out debt.
        if (accountMargin.debtUsd > 0) {
            market.totalTraderDebtUsd -= accountMargin.debtUsd;
            accountMargin.debtUsd = 0;
        }

        // For non-sUSD collateral, send to their respective reward distributor, create new distribution per collateral,
        // and then wipe out all associated collateral on the account.
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        runtime.supportedCollateralsLength = globalMarginConfig.supportedCollaterals.length;

        // Iterate over all supported margin collateral types to see if any should be distributed to LPs.
        for (uint256 i = 0; i < runtime.supportedCollateralsLength; ) {
            runtime.collateralAddress = globalMarginConfig.supportedCollaterals[i];
            runtime.availableAccountCollateral = accountMargin.collaterals[
                runtime.collateralAddress
            ];

            // Found a deposited collateral that must be distributed.
            if (runtime.availableAccountCollateral > 0) {
                ISynthetixSystem(SYNTHETIX_CORE).withdrawMarketCollateral(
                    marketId,
                    runtime.collateralAddress,
                    runtime.availableAccountCollateral
                );
                IPerpRewardDistributor distributor = IPerpRewardDistributor(
                    globalMarginConfig.supported[runtime.collateralAddress].rewardDistributor
                );
                ITokenModule(runtime.collateralAddress).transfer(
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
                    (, uint256 collateralValueUsd) = ISynthetixSystem(SYNTHETIX_CORE)
                        .getVaultCollateral(runtime.poolId, poolCollateralTypes[j]);
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
                market.depositedCollateral[runtime.collateralAddress] -= runtime
                    .availableAccountCollateral;
                accountMargin.collaterals[runtime.collateralAddress] = 0;
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
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        uint256 oraclePrice = market.getOraclePrice(addresses);
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice,
            addresses
        );

        // Cannot flag for liquidation unless they are liquidatable.

        if (
            !position.isLiquidatable(
                oraclePrice,
                PerpMarketConfiguration.load(marketId),
                marginValues,
                addresses
            )
        ) {
            revert ErrorUtil.CannotLiquidatePosition();
        }

        // Remove any pending orders that may exist.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            emit OrderCanceled(accountId, marketId, 0, order.commitmentTime);
            delete market.orders[accountId];
        }
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint256 ethPrice = INodeModule(ORACLE_MANAGER)
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

        liquidateCollateral(accountId, marketId, market);

        address msgSender = ERC2771Context._msgSender();

        // Flag and emit event.
        market.flaggedLiquidations[accountId] = msgSender;

        // Pay flagger.
        ISynthetixSystem(SYNTHETIX_CORE).withdrawMarketUsd(marketId, msgSender, flagReward);

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
        ISynthetixSystem synthetix = ISynthetixSystem(SYNTHETIX_CORE);
        uint256 oraclePrice = market.getOraclePrice(
            AddressRegistry.Data({
                synthetix: synthetix,
                sUsd: SYNTHETIX_SUSD,
                oracleManager: ORACLE_MANAGER
            })
        );
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
        synthetix.withdrawMarketUsd(marketId, msgSender, liqKeeperFee);

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

    /// @inheritdoc ILiquidationModule
    function liquidateMarginOnly(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.LIQUIDATE_MARGIN_ONLY);

        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            market.getOraclePrice(addresses),
            addresses
        );
        if (
            marginValues.collateralUsd == 0 ||
            !Margin.isMarginLiquidatable(accountId, market, marginValues, addresses)
        ) {
            revert ErrorUtil.CannotLiquidateMargin();
        }

        // Remove any pending orders that may exist.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            emit OrderCanceled(accountId, marketId, 0, order.commitmentTime);
            delete market.orders[accountId];
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        uint256 keeperReward = Margin.getMarginLiquidationOnlyReward(
            marginValues.collateralUsd,
            PerpMarketConfiguration.load(marketId),
            globalConfig,
            addresses
        );

        liquidateCollateral(accountId, marketId, market);

        // Pay the caller.
        addresses.synthetix.withdrawMarketUsd(marketId, ERC2771Context._msgSender(), keeperReward);

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
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        uint256 oraclePrice = market.getOraclePrice(addresses);
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice,
            addresses
        );
        uint256 ethPrice = INodeModule(ORACLE_MANAGER)
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
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        uint256 oraclePrice = market.getOraclePrice(addresses);

        return
            market.positions[accountId].isLiquidatable(
                oraclePrice,
                PerpMarketConfiguration.load(marketId),
                Margin.getMarginUsd(accountId, market, oraclePrice, addresses),
                addresses
            );
    }

    /// @inheritdoc ILiquidationModule
    function isMarginLiquidatable(
        uint128 accountId,
        uint128 marketId
    ) external view returns (bool) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            market.getOraclePrice(addresses),
            addresses
        );

        if (marginValues.collateralUsd == 0) {
            return false;
        }

        return Margin.isMarginLiquidatable(accountId, market, marginValues, addresses);
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
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        uint256 oraclePrice = market.getOraclePrice(addresses);
        (uint256 collateralUsd, ) = Margin.getCollateralUsd(
            Margin.load(accountId, marketId),
            PerpMarketConfiguration.load(),
            addresses
        );
        (im, mm) = Position.getLiquidationMarginUsd(
            market.positions[accountId].size + sizeDelta,
            oraclePrice,
            collateralUsd,
            marketConfig,
            addresses
        );
    }

    /// @inheritdoc ILiquidationModule
    function getHealthFactor(uint128 accountId, uint128 marketId) external view returns (uint256) {
        Account.exists(accountId);

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        AddressRegistry.Data memory addresses = AddressRegistry.Data(
            ISynthetixSystem(SYNTHETIX_CORE),
            SYNTHETIX_SUSD,
            ORACLE_MANAGER
        );
        uint256 oraclePrice = market.getOraclePrice(addresses);

        return
            Position.getHealthFactor(
                position.size,
                oraclePrice,
                PerpMarketConfiguration.load(marketId),
                Margin.getMarginUsd(accountId, market, oraclePrice, addresses),
                addresses
            );
    }
}
