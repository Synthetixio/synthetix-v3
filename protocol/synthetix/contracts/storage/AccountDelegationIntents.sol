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
        uint128 accountId;
        uint128 delegationIntentsEpoch; // nonce used to nuke previous intents using a new era (useful on liquidations)
        SetUtil.UintSet intentsId;
        mapping(bytes32 => SetUtil.UintSet) intentsByPair; // poolId/collateralType => intentIds[]
        // accounting for the intents collateral delegated
        // Per Collateral
        SetUtil.AddressSet delegatedCollaterals;
        mapping(address => int256) netDelegatedAmountPerCollateral; // collateralType => net delegatedCollateralAmount
    }

    /**
     * @dev Returns the account delegation intents stored at the specified account id.
     */
    function load(
        uint128 accountId,
        uint128 delegationIntentsEpoch
    ) internal pure returns (Data storage accountDelegationIntents) {
        bytes32 s = keccak256(
            abi.encode(
                "io.synthetix.synthetix.AccountDelegationIntents",
                accountId,
                delegationIntentsEpoch
            )
        );
        assembly {
            accountDelegationIntents.slot := s
        }
    }

    /**
     * @dev Returns the account delegation intents stored at the specified account id.
     */
    function loadValid(
        uint128 accountId
    ) internal view returns (Data storage accountDelegationIntents) {
        uint128 delegationIntentsEpoch = Account.load(accountId).currentDelegationIntentsEpoch;
        accountDelegationIntents = load(accountId, delegationIntentsEpoch);
        if (
            accountDelegationIntents.accountId != 0 &&
            (accountDelegationIntents.accountId != accountId ||
                accountDelegationIntents.delegationIntentsEpoch != delegationIntentsEpoch)
        ) {
            revert IVaultModule.InvalidDelegationIntent();
        }
    }

    /**
     * @dev Returns the account delegation intents stored at the specified account id. Checks if it's valid
     */
    function getValid(uint128 accountId) internal returns (Data storage accountDelegationIntents) {
        accountDelegationIntents = loadValid(accountId);
        if (accountDelegationIntents.accountId == 0) {
            // Uninitialized storage will have a 0 accountId; it means we need to initialize it (new accountDelegationIntents era)
            accountDelegationIntents.accountId = accountId;
            accountDelegationIntents.delegationIntentsEpoch = Account
                .load(accountId)
                .currentDelegationIntentsEpoch;
        }
    }

    function addIntent(Data storage self, DelegationIntent.Data storage delegationIntent) internal {
        self.intentsId.add(delegationIntent.id);
        self
            .intentsByPair[
                keccak256(abi.encodePacked(delegationIntent.poolId, delegationIntent.accountId))
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
                keccak256(abi.encodePacked(delegationIntent.poolId, delegationIntent.accountId))
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

    /**
     * @dev Cleans all intents (expired and not) related to the account. This should be called upon liquidation.
     */
    function cleanAllIntents(Data storage self) internal {
        // Nuke all intents by incrementing the delegationIntentsEpoch nonce
        // This is useful to avoid iterating over all intents to remove them and risking a for loop revert.
        Account.load(self.accountId).getNewDelegationIntentsEpoch();
    }
}
