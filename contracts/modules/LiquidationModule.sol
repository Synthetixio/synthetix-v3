//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {ILiquidationModule} from "../interfaces/ILiquidationModule.sol";
import {Margin} from "../storage/Margin.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Order} from "../storage/Order.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

contract LiquidationModule is ILiquidationModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Helpers --- //

    /**
     * @dev Before liquidation (not flag) to perform pre-steps and validation.
     */
    function updateMarketPreLiquidation(
        uint128 accountId,
        uint128 marketId,
        PerpMarket.Data storage market,
        uint256 oraclePrice,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private returns (Position.Data storage oldPosition, Position.Data memory newPosition, uint256 liqKeeperFee) {
        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.getCurrentFundingVelocity());
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
        market.skew = market.skew - oldPosition.size + newPosition.size;
        market.size -= liqSize;

        // Update market debt relative to the keeperFee incurred.
        market.updateDebtCorrection(market.positions[accountId], newPosition);
    }

    // --- Mutative --- //

    /**
     * @inheritdoc ILiquidationModule
     */
    function flagPosition(uint128 accountId, uint128 marketId) external {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        // Cannot flag a position that does not exist.
        if (position.size == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        // Cannot flag for liquidation unless they are liquidatable.
        uint256 oraclePrice = market.getOraclePrice();
        bool isLiquidatable = position.isLiquidatable(
            market,
            Margin.getMarginUsd(accountId, market, oraclePrice),
            oraclePrice,
            PerpMarketConfiguration.load(marketId)
        );
        if (!isLiquidatable) {
            revert ErrorUtil.CannotLiquidatePosition();
        }

        // Cannot reflag something that's already flagged.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        // Remove any pending orders that may exist.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            emit OrderCanceled(accountId, marketId, order.commitmentTime);
            delete market.orders[accountId];
        }
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint256 flagReward = Position.getLiquidationFlagReward(
            MathUtil.abs(position.size).to128(),
            oraclePrice,
            PerpMarketConfiguration.load(marketId),
            globalConfig
        );

        Position.Data memory newPosition = Position.Data(
            position.size,
            position.entryFundingAccrued,
            position.entryPrice,
            position.accruedFeesUsd + flagReward
        );
        market.updateDebtCorrection(position, newPosition);
        // Update position accounting
        position.update(newPosition);
        // Pay keeper
        globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, flagReward);
        // Flag and emit event.
        market.flaggedLiquidations[accountId] = msg.sender;
        emit PositionFlaggedLiquidation(accountId, marketId, msg.sender, flagReward, oraclePrice);

        // Sell any non sUSD collateral for sUSD post flag. Non sUSD margin value is already discounted in the quote
        // price on the synth by spot market. This simply realizes that discount.
        //
        // We sell the synth collateral here to ensure there's enough sUSD at this point in time to pay down any debt
        // incurred on this position and to also credit LPs with sUSD.
        Margin.sellAllSynthCollateralForUsd(accountId, marketId, market);
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidatePosition(uint128 accountId, uint128 marketId) external {
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

        // Full liquidation (size=0) vs. partial liquidation.
        if (newPosition.size == 0) {
            delete market.positions[accountId];
            delete market.flaggedLiquidations[accountId];

            // Zero out all sUSD that was collected after selling synth based collateral during the flag.
            Margin.Data storage accountMargin = Margin.load(accountId, marketId);
            market.depositedCollateral[SYNTHETIX_USD_MARKET_ID] -= accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID];
            accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] = 0;
        } else {
            market.positions[accountId].update(newPosition);
        }
        // Pay the keeper
        globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, liqKeeperFee);

        emit PositionLiquidated(accountId, marketId, newPosition.size, msg.sender, flagger, liqKeeperFee, oraclePrice);
    }

    // --- Views --- //

    /**
     * @inheritdoc ILiquidationModule
     */
    function getLiquidationFees(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256 flagKeeperReward, uint256 liqKeeperFee) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        uint128 absSize = MathUtil.abs(market.positions[accountId].size).to128();

        flagKeeperReward = Position.getLiquidationFlagReward(
            absSize,
            market.getOraclePrice(),
            marketConfig,
            globalConfig
        );
        liqKeeperFee = Position.getLiquidationKeeperFee(absSize, marketConfig, globalConfig);
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function getRemainingLiquidatableSizeCapacity(
        uint128 marketId
    )
        external
        view
        returns (uint128 maxLiquidatableCapacity, uint128 remainingCapacity, uint128 lastLiquidationTimestamp)
    {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.getRemainingLiquidatableSizeCapacity(PerpMarketConfiguration.load(marketId));
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function isPositionLiquidatable(uint128 accountId, uint128 marketId) external view returns (bool) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        uint256 oraclePrice = market.getOraclePrice();
        return
            market.positions[accountId].isLiquidatable(
                market,
                Margin.getMarginUsd(accountId, market, oraclePrice),
                oraclePrice,
                PerpMarketConfiguration.load(marketId)
            );
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function getLiquidationMarginUsd(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256 im, uint256 mm) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        (im, mm, ) = Position.getLiquidationMarginUsd(
            market.positions[accountId].size,
            market.getOraclePrice(),
            marketConfig
        );
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function getHealthFactor(uint128 accountId, uint128 marketId) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        uint256 oraclePrice = market.getOraclePrice();
        return
            market.positions[accountId].getHealthFactor(
                market,
                Margin.getMarginUsd(accountId, market, oraclePrice),
                oraclePrice,
                PerpMarketConfiguration.load(marketId)
            );
    }
}
