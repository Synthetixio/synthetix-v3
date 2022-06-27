//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../interfaces/IFundVaultStorage.sol";

contract FundVaultStorage is IFundVaultStorage {
    struct FundVaultStore {
        /// @dev account liquidity items
        mapping(uint256 => SetUtil.Bytes32Set) accountliquidityItems;
        /// @dev liquidity items data
        mapping(bytes32 => LiquidityItem) liquidityItems;
        /// @dev collateral types enabled/used per fund
        mapping(uint256 => SetUtil.AddressSet) fundCollateralTypes;
        /// @dev fund vaults (per collateral)
        mapping(uint256 => mapping(address => VaultData)) fundVaults;
    }

    struct VaultData {
        /// @dev total shares distributed
        uint256 totalShares;
        /// @dev total liquidity delegated to this vault
        uint256 totalCollateral;
        /// @dev total sUSD minted
        uint256 totalsUSD;
        /// @dev LiquidityItem ids in this fund
        SetUtil.Bytes32Set liquidityItemIds;
        // Accessory data to simplify views and calculations
        /// @dev LiquidityItem ids by account
        mapping(uint256 => SetUtil.Bytes32Set) liquidityItemsByAccount;
        /// @dev minted sUSD
        mapping(uint256 => uint256) sUSDByAccount;
    }

    function _fundVaultStore() internal pure returns (FundVaultStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundvault")) - 1)
            store.slot := 0xb2564d94a39cc75e0cf19479aee0e393bdff4e7a76990446a22fe065e062266a
        }
    }
}
