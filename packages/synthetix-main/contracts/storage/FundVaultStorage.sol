//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../interfaces/external/IRewardDistributor.sol";

import "../utils/SharesLibrary.sol";

contract FundVaultStorage {
    struct FundVaultStore {

        /// @dev collaterals which are currently deposited in the fund
        mapping(uint256 => SetUtil.AddressSet) fundCollateralTypes;
        
        /// @dev fund vaults (per collateral)
        mapping(uint256 => mapping(address => VaultData)) fundVaults;
    }

    struct VaultEpochData {
        /// @dev amount of debt which has not been rolled into `usdDebtDist`. Needed to keep track of overall vaultDebt
        int128 unclaimedDebt;

        /// @dev if there are liquidations, this value will be multiplied by any share counts to determine the value of the shares wrt the rest of the fund
        uint128 liquidityMultiplier;

        /// @dev tracks debt for each user
        SharesLibrary.Distribution debtDist;

        /// @dev tracks collateral for each user
        SharesLibrary.Distribution collateralDist;

        /// @dev tracks usd for each user
        SharesLibrary.Distribution usdDebtDist;
    }

    struct VaultData {
        /// @dev if vault is fully liquidated, this will be incremented to indicate reset shares
        uint epoch;

        /// @dev cached collateral price
        uint128 collateralPrice;

        /// @dev tracks debt for each user
        mapping(uint => VaultEpochData) epochData;

        /// @dev rewards
        RewardDistribution[] rewards;
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
