//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract FundModuleStorage {
    struct FundModuleStore {
        bool initialized;
        SatelliteFactory.Satellite fundToken;
        uint preferredFund;
        uint[] approvedFunds;
        mapping(uint => FundData) funds; // fund metadata by fundId
    }

    struct FundData {
        /// @dev fund configuration and market distribution
        uint targetRatio; // TODO set up and update by owner or configured by system?
        uint liquidationRatio; // TODO set up and update by owner or configured by system?
        uint totalWeights; // sum of distribution weights
        MarketDistribution[] fundDistribution;
        /// @dev collateral delegated
        SetUtil.AddressSet collateralTypes; // collateral types used to add liquidity to the fund
        mapping(address => uint) liquidityByCollateral; // total liquidity per collateral
        uint totalShares;
        /// @dev Individual Liquidity Items
        SetUtil.Bytes32Set liquidityItemIds; // All LiquidityItem ids in this fund
        mapping(uint => SetUtil.Bytes32Set) liquidityItemsByAccount; // LiquidityItem ids by account
        mapping(bytes32 => LiquidityItem) liquidityItems; // LiquidityItems data by liquidityProviderIds
    }

    struct MarketDistribution {
        uint weight;
        uint market;
    }

    struct LiquidityItem {
        address collateralType;
        uint accountId;
        uint leverage;
        uint collateralAmount;
        uint shares;
        uint initialDebt; // how that works with amount adjustments?
    }

    function _fundModuleStore() internal pure returns (FundModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundmodule")) - 1)
            store.slot := 0x777921625cac3385fe90fd55ec5b9c58ada192ff82f029c62116f9fddf316bcd
        }
    }
}
