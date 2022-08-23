//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FundModuleStorage {
    struct FundModuleStore {
        mapping(uint256 => FundData) funds; // fund metadata by fundId
    }

    struct FundData {
        /// @dev fund owner
        address owner;
        /// @dev nominated fund owner
        address nominatedOwner;
        /// @dev sum of all distributions for the fund
        uint256 totalWeights; // sum of distribution weights
        /// @dev fund distribution
        MarketDistribution[] fundDistribution;
        /// @dev fund name
        string name;
    }

    /**
     * Market Distribution is set by assigning weights to markets
     * the proportion for a market is obtained as market_distribution / totalWeights
     * where totalWeights is the sum of all MarketDistribution weights
     */
    struct MarketDistribution {
        /// @dev market baked by this fund
        uint256 market;
        /// @dev weight sent to that market
        uint128 weight;
        /// @dev cap on debt exposure for the market
        int128 maxDebtShareValue;
    }

    function _fundModuleStore() internal pure returns (FundModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundmodule")) - 1)
            store.slot := 0x777921625cac3385fe90fd55ec5b9c58ada192ff82f029c62116f9fddf316bcd
        }
    }
}
