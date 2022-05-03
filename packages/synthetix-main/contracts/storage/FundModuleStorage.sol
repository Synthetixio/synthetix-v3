//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract FundModuleStorage {
    struct FundModuleStore {
        bool initialized;
        uint latestFundId;
        mapping(uint => FundData) funds; // fund metadata by fundId
        mapping(uint => bytes32[]) liquidityProviderIds; // liquidityProvider ids by fundId
        mapping(bytes32 => LiquidityProvider) liquidityProviders; // liquidityProviders data by liquidityProviderIds
    }

    struct FundData {
        address owner;
        uint targetRatio;
        uint liquidationRatio;
        MarketExposure[] fundDistribution;
    }

    struct MarketExposure {
        uint exposure;
        address market;
        address priceOracle;
    }

    struct LiquidityProvider {
        address collateralType;
        uint fundId;
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
