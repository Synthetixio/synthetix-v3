//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./DelegationIntent.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../interfaces/IVaultModule.sol";
import "./Account.sol";

/**
 * @title Represents a delegation (or undelegation) intent.
 */
library AccountDelegationIntents {
    using SafeCastI256 for int256;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SetUtil for SetUtil.UintSet;
    using SetUtil for SetUtil.AddressSet;
    using DelegationIntent for DelegationIntent.Data;
    using Account for Account.Data;

    struct Data {
        SetUtil.UintSet intentsId;
        mapping(bytes32 => SetUtil.UintSet) intentsByPair; // poolId/collateralType => intentIds[]
        // accounting for the intents collateral delegated
        // Per Collateral
        SetUtil.AddressSet delegatedCollaterals;
        mapping(address => int256) netDelegatedAmountPerCollateral; // collateralType => net delegatedCollateralAmount
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

        self.netDelegatedAmountPerCollateral[delegationIntent.collateralType] += delegationIntent
            .deltaCollateralAmountD18;

        if (!self.delegatedCollaterals.contains(delegationIntent.collateralType)) {
            self.delegatedCollaterals.add(delegationIntent.collateralType);
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

        self.netDelegatedAmountPerCollateral[delegationIntent.collateralType] -= delegationIntent
            .deltaCollateralAmountD18;
    }

    function getIntent(
        Data storage self,
        uint256 intentId
    ) internal view returns (DelegationIntent.Data storage) {
        if (!self.intentsId.contains(intentId)) {
            revert IVaultModule.InvalidDelegationIntent();
        }
        return DelegationIntent.load(intentId);
    }

    /**
     * @dev Returns the delegation intent stored at the specified nonce id.
     */
    function intentIdsByPair(
        Data storage self,
        uint128 poolId,
        address collateralType
    ) internal view returns (uint256[] memory intentIds) {
        return self.intentsByPair[keccak256(abi.encodePacked(poolId, collateralType))].values();
    }

    function isInCurrentEpoch(Data storage self, uint256 intentId) internal view returns (bool) {
        // Notice: not checking that `self.delegationIntentsEpoch == account.currentDelegationIntentsEpoch` since
        // it was loadValid and getValid use it at load time
        return self.intentsId.contains(intentId);
    }

    /**
     * @dev Cleans all expired intents related to the account.
     */
    function cleanAllExpiredIntents(Data storage self) internal {
        uint256[] memory intentIds = self.intentsId.values();
        for (uint256 i = 0; i < intentIds.length; i++) {
            DelegationIntent.Data storage intent = DelegationIntent.load(intentIds[i]);
            if (intent.intentExpired()) {
                removeIntent(self, intent);
            }
        }
    }
}
