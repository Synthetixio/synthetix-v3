//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";

library PerpMarketConfiguration {
    // --- Constants --- //

    bytes32 private constant _SLOT_NAMESPACE = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarketConfiguration"));

    // --- Storage --- //

    // @dev Perp market configuration shared across all markets
    struct GlobalData {
        // A reference to the core Synthetix v3 system.
        ISynthetixSystem synthetix;
        // A reference to the snxUSD stablecoin.
        // TODO: Rename to usdToken.
        ITokenModule snxUsdToken;
        // A reference to the Synthetix oracle manager (used to fetch market prices).
        INodeModule oracleManager;
        // A reference to the Pyth EVM contract.
        IPyth pyth;
        // The minimum required margin in USD a position must hold.
        uint256 minMarginUsd;
        // In bps the maximum deviation between on-chain prices and Pyth prices for settlements.
        uint128 priceDivergencePercent;
        // Minimum acceptable publishTime from Pyth WH VAA price update data.
        int128 pythPublishTimeMin;
        // Max acceptable publishTime from Pyth.
        int128 pythPublishTimeMax;
        // Minimum amount of time (in seconds) required for an order to exist before settlement.
        uint128 minOrderAge;
        // Maximum order age (in seconds) before the order becomes stale.
        uint128 maxOrderAge;
        // The minimum amount in USD a keeper should receive on settlements/liquidations.
        uint256 minKeeperFeeUsd;
        // The maximum amount in USD a keeper should receive on settlements/liquidations.
        uint256 maxKeeperFeeUsd;
        // A multiplier on the base keeper fee derived as a profit margin on settlements/liquidations.
        uint128 keeperProfitMarginPercent;
        // Number of gas units required to perform an order settlement by a keeper.
        uint256 keeperSettlementGasUnits;
        // Number of gas units required to liquidate a position by a keeper.
        uint256 keeperLiquidationGasUnits;
        // A fixed fee sent to the liquidator upon position liquidation.
        uint256 keeperLiquidationFeeUsd;
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
        // TODO: Pack maxLeverage, maxMarketSize, maxFundingVelocity and skewScale into 256bits.
        // Maximum amount of leverage a position can take on in this market (e.g. 25x)
        uint128 maxLeverage;
        // Maximum amount of size in native units for either side of the market (OI would be maxMarketSize * 2).
        uint128 maxMarketSize;
        // The maximum velocity funding rate can change by.
        uint128 maxFundingVelocity;
        // Skew scaling denominator constant.
        uint128 skewScale;
        // Liquidation buffer (penality) in bps (on p.size * price) to prevent negative margin on liquidation.
        uint256 liquidationBufferPercent;
        // Liquidation fee in bps (% of p.size * price) paid to LPers.
        uint256 liquidationFeePercent;
        // Multiplier applied when calculating the liquidation premium margin.
        uint256 liquidationPremiumMultiplier;
    }

    function load(uint128 marketId) internal pure returns (PerpMarketConfiguration.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarketConfiguration", marketId));

        assembly {
            d.slot := s
        }
    }

    function load() internal pure returns (PerpMarketConfiguration.GlobalData storage d) {
        bytes32 s = _SLOT_NAMESPACE;

        assembly {
            d.slot := s
        }
    }
}
