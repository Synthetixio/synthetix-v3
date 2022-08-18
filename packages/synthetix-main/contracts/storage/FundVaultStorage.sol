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

        /// @dev tracks debt for each fund
        mapping(uint256 => SharesLibrary.Distribution) fundDists;
    }
    
    /// @notice LiquidityItem struct definition. Account/CollateralType/FundId uniquiely identifies it
    struct LiquidityItem {
        uint128 usdMinted;
        int128 cumulativeDebt;

        uint128 leverage;
    }

    struct VaultData {
        /// @dev if there are liquidations, this value will be multiplied by any share counts to determine the value of the shares wrt the rest of the fund
        uint128 sharesMultiplier;

        /// @dev total liquidity delegated to this vault
        uint128 totalCollateral;

        /// @dev total USD minted

        /// @dev LiquidityItem ids in this fund
        SetUtil.Bytes32Set liquidityItemIds;

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
