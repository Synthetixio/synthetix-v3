//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../interfaces/IVaultModuleStorage.sol";

import "../interfaces/external/IRewardDistributor.sol";

contract FundVaultStorage is IVaultModuleStorage {
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
        /// @dev total USD minted
        uint256 totalUSD;
        /// @dev LiquidityItem ids in this fund
        SetUtil.Bytes32Set liquidityItemIds;
        // Accessory data to simplify views and calculations
        /// @dev LiquidityItem ids by account
        mapping(uint256 => SetUtil.Bytes32Set) liquidityItemsByAccount;
        /// @dev minted USD
        mapping(uint256 => uint256) usdByAccount;
        /// @dev rewards
        RewardDistribution[] rewards;
    }

    struct RewardDistribution {
        // 3rd party smart contract which holds/mints the funds
        IRewardDistributor distributor;
        // total amount of the distribution
        uint128 amount;
        // set to <= block.timestamp to distribute immediately to currently staked users
        uint64 start;
        uint128 accumulatedPerShare;
        uint64 duration;
        // set to 0 to instantly distribute rewards
        uint64 lastUpdate;
        mapping(uint => uint128) lastAccumulated;
    }

    function _fundVaultStore() internal pure returns (FundVaultStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundvault")) - 1)
            store.slot := 0xb2564d94a39cc75e0cf19479aee0e393bdff4e7a76990446a22fe065e062266a
        }
    }
}
