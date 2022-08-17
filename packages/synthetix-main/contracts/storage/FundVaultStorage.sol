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

        /// @dev tracks debt for each vault
        mapping(uint256 => SharesLibrary.Distribution) debtDists;
    }
    
    /// @notice LiquidityItem struct definition. Account/CollateralType/FundId uniquiely identifies it
    struct LiquidityItem {
        uint256 accountId;
        address collateralType;
        uint256 fundId;
        
        uint128 shares;
        uint128 leverage;

        uint128 collateralAmount;
        int128 lastDebt;

    }

    struct VaultData {
        /// @dev total shares distributed
        uint128 totalShares;
        /// @dev if there are liquidations, this value will be multiplied by `totalShares` to determine the value of the shares wrt the rest of the fund
        uint128 sharesMultiplier;

        /// @dev total liquidity delegated to this vault
        uint128 totalCollateral;
        /// @dev total USD minted
        uint128 totalUSD;

        /// @dev LiquidityItem ids in this fund
        SetUtil.Bytes32Set liquidityItemIds;
        /// @dev minted USD
        mapping(uint256 => uint256) usdByAccount;

        /// @dev tracks debt for each user
        SharesLibrary.Distribution debtDist;

        /// @dev rewards
        RewardDistribution[] rewards;
    }

    struct RewardDistribution {
        // 3rd party smart contract which holds/mints the funds
        IRewardDistributor distributor;
        SharesLibrary.Distribution reward;
    }

    function _fundVaultStore() internal pure returns (FundVaultStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundvault")) - 1)
            store.slot := 0xb2564d94a39cc75e0cf19479aee0e393bdff4e7a76990446a22fe065e062266a
        }
    }
}
