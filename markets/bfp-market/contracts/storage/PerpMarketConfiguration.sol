//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

library PerpMarketConfiguration {
    using SafeCastI256 for int256;

    // --- Storage --- //

    struct GlobalData {
        /// A reference to the core Synthetix v3 system.
        ISynthetixSystem synthetix;
        /// A reference to the Synthetix USD stablecoin.
        ITokenModule usdToken;
        /// A reference to the Synthetix oracle manager (used to fetch market prices).
        INodeModule oracleManager;
        /// A reference to the Pyth EVM contract.
        IPyth pyth;
        /// Oracle node id for for eth/usd.
        bytes32 ethOracleNodeId;
        /// Address of generic PerpRewardDistributor contract.
        address rewardDistributorImplementation;
        /// Minimum acceptable publishTime from Pyth WH VAA price update data.
        uint64 pythPublishTimeMin;
        /// Max acceptable publishTime from Pyth.
        uint64 pythPublishTimeMax;
        /// Minimum amount of time (in seconds) required for an order to exist before settlement.
        uint128 minOrderAge;
        /// Maximum order age (in seconds) before the order becomes stale.
        uint128 maxOrderAge;
        /// The min amount in USD a keeper should receive on settlements (currently not used for liquidations).
        uint256 minKeeperFeeUsd;
        /// The maximum amount in USD a keeper should receive on settlements/liquidations.
        uint256 maxKeeperFeeUsd;
        /// This is used to ensure we have incentives to liquidate small positions
        uint128 keeperProfitMarginUsd;
        /// A multiplier on the base keeper fee derived as a profit margin on settlements/liquidations.
        uint128 keeperProfitMarginPercent;
        /// Number of gas units required to perform an order settlement by a keeper.
        uint128 keeperSettlementGasUnits;
        /// Number of gas units required to perform an order cancellation by a keeper.
        uint128 keeperCancellationGasUnits;
        /// Number of gas units required to liquidate a position by a keeper.
        uint128 keeperLiquidationGasUnits;
        /// Number of gas units required to flag a position by a keeper.
        uint128 keeperFlagGasUnits;
        /// Number of gas units required to liquidate margin only by a keeper.
        uint128 keeperLiquidateMarginGasUnits;
        /// A fixed fee sent to the liquidator upon position liquidation.
        uint256 keeperLiquidationFeeUsd;
        /// Address of endorsed liquidation keeper to exceed liq caps.
        address keeperLiquidationEndorsed;
        /// A scalar applied on the collateral amount as part of discount adjustment.
        uint128 collateralDiscountScalar;
        /// Minimum discount applied on deposited margin collateral.
        uint128 minCollateralDiscount;
        /// Maximum discount applied on deposited margin collateral.
        uint128 maxCollateralDiscount;
        /// Maximum slippage on collateral sold for negative pnl position modifications.
        uint128 sellExactInMaxSlippagePercent;
        /// Dictates wheter or not the utilization rate should use high or low slope
        uint128 utilizationBreakpointPercent;
        /// Used for utilization interest when below utilization breakpoint
        uint128 lowUtilizationSlopePercent;
        /// Used for utilization interest when above utilization breakpoint
        uint128 highUtilizationSlopePercent;
    }

    struct Data {
        /// Oracle node id for price feed data.
        bytes32 oracleNodeId;
        /// The Pyth price feedId for this market.
        bytes32 pythPriceFeedId;
        /// Fee paid (in bps) when the order _decreases_ skew.
        uint128 makerFee;
        /// Fee paid (in bps) when the order _increases_ skew.
        uint128 takerFee;
        /// Maximum amount of size in native units for either side of the market (OI would be maxMarketSize * 2).
        uint128 maxMarketSize;
        /// The maximum velocity funding rate can change by.
        uint128 maxFundingVelocity;
        /// Skew scaling denominator constant.
        uint128 skewScale;
        /// If the absolute proportional skew abs(skew/skewScale) is below this value, the funding velocity will be 0
        uint128 fundingVelocityClamp;
        /// A multiplier on OI * price * minCreditPercent to increase/decrease min credit for market.
        uint128 minCreditPercent;
        /// Minimum margin in USD added to MM and IM.
        uint256 minMarginUsd;
        /// Used in addition with IMR to determine IM and MM.
        uint256 minMarginRatio;
        /// Scalar is used to dynamically infer the initial margin.
        uint256 incrementalMarginScalar;
        /// MMS used to dynamically infer the MMR' based on IMR'.
        uint256 maintenanceMarginScalar;
        /// A max cap on the IMR.
        uint256 maxInitialMarginRatio;
        /// Used to infer a % of position notional as liquidation reward.
        uint256 liquidationRewardPercent;
        /// An optional multiplier (1 to be optional) on top of maker+taker / skewScale.
        uint128 liquidationLimitScalar;
        /// Liquidation window duration in seconds (e.g. 30s -> 30, <>30e18)
        uint128 liquidationWindowDuration;
        /// If below, allows further liquidations of pd is below this maximum and caps are reached.
        uint128 liquidationMaxPd;
    }

    function load() internal pure returns (PerpMarketConfiguration.GlobalData storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.GlobalPerpMarketConfiguration"));
        assembly {
            d.slot := s
        }
    }

    function load(uint128 marketId) internal pure returns (PerpMarketConfiguration.Data storage d) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.bfp-market.PerpMarketConfiguration", marketId)
        );
        assembly {
            d.slot := s
        }
    }
}
