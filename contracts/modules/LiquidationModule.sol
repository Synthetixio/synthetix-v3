//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpCollateral} from "../storage/PerpCollateral.sol";
import {Position} from "../storage/Position.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import "../interfaces/ILiquidationModule.sol";

contract LiquidationModule is ILiquidationModule {
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Mutative --- //

    /**
     * @inheritdoc ILiquidationModule
     */
    function flagPosition(uint128 accountId, uint128 marketId) external {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        bool isLiquidatable = market.positions[accountId].isLiquidatable(
            PerpCollateral.getCollateralUsd(accountId, marketId),
            market.getOraclePrice(),
            PerpMarketConfiguration.load(marketId)
        );

        // Cannot flag for liquidation unless they are liquidatable.
        if (!isLiquidatable) {
            revert ErrorUtil.CannotLiquidatePosition();
        }

        // Cannot reflag.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
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
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        uint256 oraclePrice = market.getOraclePrice();
        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.getCurrentFundingVelocity());

        (Position.Data memory newPosition, uint128 liqSize, uint256 liqReward, uint256 keeperFee) = Position
            .validateLiquidation(accountId, market, marketConfig, oraclePrice);

        // TODO: Similar to settleOrder, we need to update market with latest skew/size etc.
        market.updatePosition(newPosition);

        market.lastLiquidationTime = block.timestamp;
        market.lastLiquidationUtilization += liqSize;

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        address flagger = market.flaggedLiquidations[accountId];
        if (flagger == msg.sender) {
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, liqReward + keeperFee);
        } else {
            globalConfig.synthetix.withdrawMarketUsd(marketId, flagger, liqReward);
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, keeperFee);
        }

        emit PositionLiquidated(accountId, marketId, msg.sender, flagger, liqReward, keeperFee);

        // No need to interact with the Synthetix core system. Collateral has already been deposited. We just need to update
        // internal account to reflect debt has been reduced allowing LPs to mint more pro rata.
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

        (, , liqReward) = Position.getLiquidationMarginUsd(
            market.positions[accountId].size,
            market.getOraclePrice(),
            PerpMarketConfiguration.load(marketId)
        );
        keeperFee = Position.getLiquidationKeeperFee();
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function getRemainingLiquidatableCapacity(uint128 marketId) external view returns (uint128) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.getRemainingLiquidatableCapacity(PerpMarketConfiguration.load(marketId));
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function isPositionLiquidatable(uint128 accountId, uint128 marketId) external view returns (bool) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return
            market.positions[accountId].isLiquidatable(
                PerpCollateral.getCollateralUsd(accountId, marketId),
                market.getOraclePrice(),
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
    function getHealthRating(uint128 accountId, uint128 marketId) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return
            market.positions[accountId].getHealthRating(
                PerpCollateral.getCollateralUsd(accountId, marketId),
                market.getOraclePrice(),
                PerpMarketConfiguration.load(marketId)
            );
    }
}
