//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./DelegationIntent.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Represents a delegation (or undelegation) intent.
 */
library AccountDelegationIntents {
    using SafeCastI256 for int256;
    using SafeCastU128 for uint128;
    using SetUtil for SetUtil.UintSet;

    error InvalidAccountDelegationIntents();

    struct Data {
        uint128 accountId;
        SetUtil.UintSet intentsId;
        mapping(bytes32 => SetUtil.UintSet) intentsByPair; // poolId/collateralId => intentIds[]
        // accounting for the intents collateral delegated
        mapping(uint128 => uint256) delegatedCollateralAmountPerPool; // poolId => delegatedCollateralAmount
        uint256 delegateCollateralCache;
        mapping(uint128 => uint256) undelegatedCollateralAmountPerPool; // poolId => undelegatedCollateralAmount
        uint256 undelegateCollateralCachePerAccount;
    }

    /**
     * @dev Returns the account delegation intents stored at the specified account id.
     */
    function load(uint128 id) internal pure returns (Data storage accountDelegationIntents) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.AccountDelegationIntents", id));
        assembly {
            accountDelegationIntents.slot := s
        }
    }

    /**
     * @dev Returns the account delegation intents stored at the specified account id. Checks if it's valid
     */
    function loadValid(uint128 id) internal view returns (Data storage accountDelegationIntents) {
        accountDelegationIntents = load(id);

        if (accountDelegationIntents.accountId != id) {
            revert InvalidAccountDelegationIntents();
        }
    }

    function addIntent(Data storage self, DelegationIntent.Data storage delegationIntent) internal {
        self.intentsId.add(delegationIntent.id);
        self
            .intentsByPair[
                keccak256(
                    abi.encodePacked(delegationIntent.poolId, delegationIntent.collateralType)
                )
            ]
            .add(delegationIntent.id);

        if (delegationIntent.collateralDeltaAmountD18 >= 0) {
            self.delegatedCollateralAmountPerPool[delegationIntent.poolId] += delegationIntent
                .collateralDeltaAmountD18
                .toUint();
            self.delegateCollateralCache += delegationIntent.collateralDeltaAmountD18.toUint();
        } else {
            self.undelegatedCollateralAmountPerPool[delegationIntent.poolId] += (delegationIntent
                .collateralDeltaAmountD18 * -1).toUint();
            self.undelegateCollateralCachePerAccount += (delegationIntent.collateralDeltaAmountD18 *
                -1).toUint();
        }
    }

    function removeIntent(
        Data storage self,
        DelegationIntent.Data storage delegationIntent
    ) internal {
        if (!self.intentsId.contains(delegationIntent.id)) {
            return;
        }

        self.intentsId.remove(delegationIntent.id);
        self
            .intentsByPair[
                keccak256(
                    abi.encodePacked(delegationIntent.poolId, delegationIntent.collateralType)
                )
            ]
            .remove(delegationIntent.id);

        if (delegationIntent.collateralDeltaAmountD18 >= 0) {
            self.delegatedCollateralAmountPerPool[delegationIntent.poolId] -= delegationIntent
                .collateralDeltaAmountD18
                .toUint();
            self.delegateCollateralCache -= delegationIntent.collateralDeltaAmountD18.toUint();
        } else {
            self.undelegatedCollateralAmountPerPool[delegationIntent.poolId] -= (delegationIntent
                .collateralDeltaAmountD18 * -1).toUint();
            self.undelegateCollateralCachePerAccount -= (delegationIntent.collateralDeltaAmountD18 *
                -1).toUint();
        }
    }

    /**
     * @dev Returns the delegation intent stored at the specified nonce id.
     */
    function intentIdsByPair(
        Data storage self,
        uint128 poolId,
        uint128 accountId
    ) internal view returns (uint256[] memory intentIds) {
        return self.intentsByPair[keccak256(abi.encodePacked(poolId, accountId))].values();
    }

    function cleanAllIntents(Data storage self) internal {
        uint256[] memory intentIds = self.intentsId.values();
        for (uint256 i = 0; i < intentIds.length; i++) {
            DelegationIntent.Data storage intent = DelegationIntent.load(intentIds[i]);
            removeIntent(self, intent);
        }
    }
}
