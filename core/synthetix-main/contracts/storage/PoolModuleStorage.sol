//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";

contract PoolModuleStorage {
    struct PoolModuleStore {
        uint minLiquidityRatio;
        mapping(uint256 => PoolData) pools; // pool metadata by poolId
    }

    struct PoolData {
        /// @dev pool name
        string name;
        /// @dev pool owner
        address owner;
        /// @dev nominated pool owner
        address nominatedOwner;
        /// @dev sum of all distributions for the pool
        uint256 totalWeights; // sum of distribution weights
        /// @dev pool distribution
        MarketDistribution[] poolDistribution;
        /// @dev tracks debt for the pool
        SharesLibrary.Distribution debtDist;
        /// @dev tracks USD liquidity provided by connected vaults. Unfortunately this value has to be computed/updated separately from shares
        /// because liquidations can cause share count to deviate from actual liquidity.
        /// Is signed integer because a pool could technically go completely underwater, but this is unlikely
        int128 totalLiquidity;
        // we might want to use this in the future, can be renamed when that time comes, possibly liquidation related
        uint128 unused;
    }

    /**
     * Market Distribution is set by assigning weights to markets
     * the proportion for a market is obtained as market_distribution / totalWeights
     * where totalWeights is the sum of all MarketDistribution weights
     */
    struct MarketDistribution {
        /// @dev market baked by this pool
        uint256 market;
        /// @dev weight sent to that market
        uint128 weight;
        /// @dev cap on debt exposure for the market
        int128 maxDebtShareValue;
    }

    function _poolModuleStore() internal pure returns (PoolModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.poolmodule")) - 1)
            store.slot := 0x777921625cac3385fe90fd55ec5b9c58ada192ff82f029c62116f9fddf316bcd
        }
    }
}
