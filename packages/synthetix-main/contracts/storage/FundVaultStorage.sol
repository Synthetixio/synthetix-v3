//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../interfaces/external/IRewardDistributor.sol";

import "../utils/SharesLibrary.sol";

contract FundVaultStorage {
    struct FundVaultStore {
        /// @dev liquidity items data
        mapping(bytes32 => LiquidityItem) liquidityItems;

        /// @dev collaterals which are currently deposited in the fund
        mapping(uint256 => SetUtil.AddressSet) fundCollateralTypes;
        
        /// @dev fund vaults (per collateral)
        mapping(uint256 => mapping(address => VaultData)) fundVaults;
    }
    
    /// @notice LiquidityItem struct definition. Account/CollateralType/FundId uniquiely identifies it
    struct LiquidityItem {
        uint128 usdMinted;
        int128 cumulativeDebt;

        uint128 leverage;
    }

    struct VaultData {
        /// @dev if vault is fully liquidated, this will be incremented to indicate reset shares
        uint epoch;

        /// @dev cached collateral price
        uint128 collateralPrice;
        /// @dev if there are liquidations, this value will be multiplied by any share counts to determine the value of the shares wrt the rest of the fund
        uint128 liquidityMultiplier;

        /// @dev the amount of debt accrued. starts at 0. this is technically a cached value, but it is needed for liquidations
        int128 totalDebt;

        /// @dev total liquidity delegated to this vault
        uint128 totalCollateral;

        /// @dev tracks debt for each user
        SharesLibrary.Distribution debtDist;

        /// @dev rewards
        RewardDistribution[] rewards;

        /// @dev last epoch which an account was seen for. If this differs from , shares are reset
        mapping (uint256 => uint) lastEpoch;
    }

    struct RewardDistribution {
        // 3rd party smart contract which holds/mints the funds
        IRewardDistributor distributor;

        SharesLibrary.DistributionEntry entry;

        uint128 rewardPerShare;

        mapping(uint256 => RewardDistributionStatus) actorInfo;
    }

    struct RewardDistributionStatus {
        uint128 lastRewardPerShare;
        uint128 pendingSend;
    }

    function _fundVaultStore() internal pure returns (FundVaultStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundvault")) - 1)
            store.slot := 0xb2564d94a39cc75e0cf19479aee0e393bdff4e7a76990446a22fe065e062266a
        }
    }
}
