//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../interfaces/IFundModuleStorage.sol";

contract FundModuleStorage is IFundModuleStorage {
    struct FundModuleStore {
        bool initialized;
        SatelliteFactory.Satellite fundToken;
        uint256 preferredFund;
        uint256[] approvedFunds;
        mapping(uint256 => FundData) funds; // fund metadata by fundId
        mapping(uint256 => SetUtil.Bytes32Set) accountliquidityItems;
        mapping(bytes32 => LiquidityItem) liquidityItems; // LiquidityItems data by liquidityProviderIds
    }

    struct FundData {
        /// @dev fund configuration and market distribution
        uint256 totalWeights; // sum of distribution weights
        MarketDistribution[] fundDistribution;
        // TODO Everything below this line should be split per collateralType
        // according to May 23th discussion Funds should be "single" collateral
        /// @dev fund economics
        uint256 totalShares; // total shares distributed
        uint256 totalsUSD;
        /// @dev collateral delegated
        SetUtil.AddressSet collateralTypes; // collateral types used to add liquidity to the fund
        mapping(address => uint256) liquidityByCollateral; // total liquidity per collateral
        /// @dev Individual Liquidity Items
        SetUtil.Bytes32Set liquidityItemIds; // All LiquidityItem ids in this fund
        mapping(uint256 => SetUtil.Bytes32Set) liquidityItemsByAccount; // LiquidityItem ids by account
        /// @dev minted sUSD
        mapping(uint256 => uint256) sUSDByAccount;
        mapping(uint256 => mapping(address => uint256)) sUSDByAccountAndCollateral;
    }

    struct MarketDistribution {
        uint256 weight;
        uint256 market;
    }

    function _fundModuleStore() internal pure returns (FundModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundmodule")) - 1)
            store.slot := 0x777921625cac3385fe90fd55ec5b9c58ada192ff82f029c62116f9fddf316bcd
        }
    }
}
