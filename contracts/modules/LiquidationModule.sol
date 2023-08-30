//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Margin} from "../storage/Margin.sol";
import {Position} from "../storage/Position.sol";
import {Order} from "../storage/Order.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import "../interfaces/ILiquidationModule.sol";

contract LiquidationModule is ILiquidationModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Mutative --- //

    /**
     * @inheritdoc ILiquidationModule
     */
    function flagPosition(uint128 accountId, uint128 marketId) external {
        Account.exists(accountId);
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
            emit OrderCanceled(accountId, marketId);
            delete market.orders[accountId];
        }

        // Flag and emit event.
        market.flaggedLiquidations[accountId] = msg.sender;
        emit PositionFlaggedLiquidation(accountId, marketId, msg.sender);
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidatePosition(uint128 accountId, uint128 marketId) external {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        uint256 oraclePrice = market.getOraclePrice();
        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.getCurrentFundingVelocity());

        (
            Position.Data storage oldPosition,
            Position.Data memory newPosition,
            uint128 liqSize,
            uint256 liqReward,
            uint256 keeperFee
        ) = Position.validateLiquidation(accountId, market, PerpMarketConfiguration.load(marketId), oraclePrice);

        // Update market to reflect a successful full or partial liquidation.
        market.lastLiquidationTime = block.timestamp;
        market.lastLiquidationUtilization += liqSize;
        market.skew -= oldPosition.size;
        market.size -= MathUtil.abs(oldPosition.size).to128();

        // Update market debt relative to the liqReward and keeperFee incurred.
        uint256 marginUsd = Margin.getMarginUsd(accountId, market, oraclePrice);
        uint256 newMarginUsd = MathUtil.max(marginUsd.toInt() - liqReward.toInt() - keeperFee.toInt(), 0).toUint();
        market.updateDebtCorrection(market.positions[accountId], newPosition, marginUsd, newMarginUsd);

        // Full liquidation (size=0) vs. partial liquidation.
        if (newPosition.size == 0) {
            delete market.positions[accountId];
            delete market.flaggedLiquidations[accountId];
            Margin.clearAccountCollateral(accountId, marketId);
        } else {
            market.positions[accountId].update(newPosition);
        }

        address flagger = market.flaggedLiquidations[accountId];
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        if (flagger == msg.sender) {
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, liqReward + keeperFee);
        } else {
            globalConfig.synthetix.withdrawMarketUsd(marketId, flagger, liqReward);
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, keeperFee);
        }

        emit PositionLiquidated(accountId, marketId, msg.sender, flagger, liqReward, keeperFee);
    }

    // --- Views --- //

    /**
     * @inheritdoc ILiquidationModule
     */
    function getLiquidationFees(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256 liqReward, uint256 keeperFee) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        liqReward = Position.getLiquidationReward(
            market.positions[accountId].size,
            market.getOraclePrice(),
            PerpMarketConfiguration.load(marketId)
        );
        keeperFee = Position.getLiquidationKeeperFee();
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function getRemainingLiquidatableSizeCapacity(uint128 marketId) external view returns (uint128) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.getRemainingLiquidatableSizeCapacity(PerpMarketConfiguration.load(marketId));
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function isPositionLiquidatable(uint128 accountId, uint128 marketId) external view returns (bool) {
        Account.exists(accountId);
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
        Account.exists(accountId);
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
