//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../external/ISpotMarketSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";

// @dev A static uint128 of the sUSD marketId.
uint128 constant SYNTHETIX_USD_MARKET_ID = 0;

/**
 * @dev Market specific and shared configuration.
 */
library PerpMarketConfiguration {
    using SafeCastI256 for int256;

    // --- Constants --- //

    bytes32 private constant SLOT_NAME = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarketConfiguration"));

    // --- Storage --- //

    // TODO: Slot pack the hell out of GlobalData and Data.

    // @dev Perp market configuration shared across all markets
    struct GlobalData {
        // A reference to the core Synthetix v3 system.
        ISynthetixSystem synthetix;
        // A reference to the core Synthetix v3 spot market system.
        ISpotMarketSystem spotMarket;
        // A reference to the Synthetix USD stablecoin.
        ITokenModule usdToken;
        // A reference to the Synthetix oracle manager (used to fetch market prices).
        INodeModule oracleManager;
        // A reference to the Pyth EVM contract.
        IPyth pyth;
        // Oracle node id for for eth/usd.
        bytes32 ethOracleNodeId;
        // In bps the maximum deviation between on-chain prices and Pyth prices for settlements.
        uint128 priceDivergencePercent;
        // Minimum acceptable publishTime from Pyth WH VAA price update data.
        uint64 pythPublishTimeMin;
        // Max acceptable publishTime from Pyth.
        uint64 pythPublishTimeMax;
        // Minimum amount of time (in seconds) required for an order to exist before settlement.
        uint128 minOrderAge;
        // Maximum order age (in seconds) before the order becomes stale.
        uint128 maxOrderAge;
        // The min amount in USD a keeper should receive on settlements (currently not used for liquidations).
        uint256 minKeeperFeeUsd;
        // The maximum amount in USD a keeper should receive on settlements/liquidations.
        uint256 maxKeeperFeeUsd;
        // This is used to ensure we have incentives to liquidate small positions
        uint128 keeperProfitMarginUsd;
        // A multiplier on the base keeper fee derived as a profit margin on settlements/liquidations.
        uint128 keeperProfitMarginPercent;
        // Number of gas units required to perform an order settlement by a keeper.
        uint128 keeperSettlementGasUnits;
        // Number of gas units required to liquidate a position by a keeper.
        uint128 keeperLiquidationGasUnits;
        // Number of gas units required to flag a position by a keeper.
        uint128 keeperFlagGasUnits;
        // A fixed fee sent to the liquidator upon position liquidation.
        uint256 keeperLiquidationFeeUsd;
        // Address of endorsed liquidation keeper to exceed liq caps.
        address keeperLiquidationEndorsed;
    }

    // @dev Perp market configuration specific to a market
    struct Data {
        // Oracle node id for price feed data.
        bytes32 oracleNodeId;
        // The Pyth price feedId for this market.
        bytes32 pythPriceFeedId;
        // Fee paid (in bps) when the order _decreases_ skew.
        uint128 makerFee;
        // Fee paid (in bps) when the order _increases_ skew.
        uint128 takerFee;
        // Maximum amount of size in native units for either side of the market (OI would be maxMarketSize * 2).
        uint128 maxMarketSize;
        // The maximum velocity funding rate can change by.
        uint128 maxFundingVelocity;
        // Skew scaling denominator constant.
        uint128 skewScale;
        // A multiplier on OI * price * minCreditPercent to increase/decrease min credit for market.
        uint128 minCreditPercent;
        // Minimum margin in USD added to MM and IM.
        uint256 minMarginUsd;
        // Used in addition with IMR to determine IM and MM.
        uint256 minMarginRatio;
        // Scalar is used to dynamically infer the initial margin.
        uint256 incrementalMarginScalar;
        // MMS used to dynamically infer the MMR' based on IMR'.
        uint256 maintenanceMarginScalar;
        // Used to infer a % of position notional as liquidation reward.
        uint256 liquidationRewardPercent;
        // An optional multiplier (1 to be optional) on top of maker+taker / skewScale.
        uint128 liquidationLimitScalar;
        // Liquidation window duration in seconds (e.g. 30s -> 30, <>30e18)
        uint128 liquidationWindowDuration;
        // If below, allows further liquidations of pd is below this maximum and caps are reached.
        uint128 liquidationMaxPd;
    }

    function load(uint128 marketId) internal pure returns (PerpMarketConfiguration.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarketConfiguration", marketId));

        assembly {
            d.slot := s
        }
    }

    function load() internal pure returns (PerpMarketConfiguration.GlobalData storage d) {
        bytes32 s = SLOT_NAME;

        assembly {
            d.slot := s
        }
    }
}
