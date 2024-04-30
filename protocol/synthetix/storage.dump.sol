// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

// @custom:artifact contracts/storage/Vault.sol:Vault
import "contracts/storage/VaultEpoch.sol";
import "contracts/storage/RewardDistribution.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
library Vault {
    struct Data {
        uint256 epoch;
        bytes32 __slotAvailableForFutureUse;
        int128 _unused_prevTotalDebtD18;
        mapping(uint256 => VaultEpoch.Data) epochData;
        mapping(bytes32 => RewardDistribution.Data) rewards;
        SetUtil.Bytes32Set rewardIds;
    }
    struct PositionSelector {
        uint128 accountId;
        uint128 poolId;
        address collateralType;
    }
}
