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
    using SafeCastU256 for uint256;
    using SetUtil for SetUtil.UintSet;
    using SetUtil for SetUtil.AddressSet;

    error InvalidAccountDelegationIntents();

    struct Data {
        uint128 accountId;
        SetUtil.UintSet intentsId;
        mapping(bytes32 => SetUtil.UintSet) intentsByPair; // poolId/collateralId => intentIds[]
        // accounting for the intents collateral delegated
        // Per Pool
        SetUtil.UintSet delegatedPools;
        mapping(uint128 => int256) netDelegatedCollateralAmountPerPool; // poolId => net delegatedCollateralAmount
        mapping(uint128 => uint256) delegatedCollateralAmountPerPool; // poolId => delegatedCollateralAmount
        uint256 delegateAcountCachedCollateral;
        mapping(uint128 => uint256) undelegatedCollateralAmountPerPool; // poolId => undelegatedCollateralAmount
        uint256 undelegateAcountCachedCollateral;
        // Per Collateral
        SetUtil.AddressSet delegatedCollaterals;
        mapping(address => int256) netDelegatedAmountPerCollateral; // poolId => net delegatedCollateralAmount
        mapping(address => uint256) delegatedAmountPerCollateral; // collateralType => delegatedCollateralAmount
        mapping(address => uint256) undelegatedAmountPerCollateral; // collateralType => undelegatedCollateralAmount
        // Global
        int256 netAcountCachedDelegatedCollateral;
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
    function getValid(uint128 id) internal returns (Data storage accountDelegationIntents) {
        accountDelegationIntents = load(id);
        if (accountDelegationIntents.accountId == 0) {
            // Uninitialized storage will have a 0 accountId
            accountDelegationIntents.accountId = id;
        }

        if (accountDelegationIntents.accountId != id) {
            revert InvalidAccountDelegationIntents();
        }
    }

    function addIntent(Data storage self, DelegationIntent.Data storage delegationIntent) internal {
        self.intentsId.add(delegationIntent.id);
        self
            .intentsByPair[
                keccak256(abi.encodePacked(delegationIntent.poolId, delegationIntent.accountId))
            ]
            .add(delegationIntent.id);

        if (delegationIntent.collateralDeltaAmountD18 >= 0) {
            self.delegatedAmountPerCollateral[delegationIntent.collateralType] += delegationIntent
                .collateralDeltaAmountD18
                .toUint();
            self.delegatedCollateralAmountPerPool[delegationIntent.poolId] += delegationIntent
                .collateralDeltaAmountD18
                .toUint();
            self.delegateAcountCachedCollateral += delegationIntent
                .collateralDeltaAmountD18
                .toUint();
        } else {
            self.undelegatedAmountPerCollateral[
                delegationIntent.collateralType
            ] += (delegationIntent.collateralDeltaAmountD18 * -1).toUint();
            self.undelegatedCollateralAmountPerPool[delegationIntent.poolId] += (delegationIntent
                .collateralDeltaAmountD18 * -1).toUint();
            self.undelegateAcountCachedCollateral += (delegationIntent.collateralDeltaAmountD18 *
                -1).toUint();
        }
        self.netDelegatedAmountPerCollateral[delegationIntent.collateralType] += delegationIntent
            .collateralDeltaAmountD18;
        self.netDelegatedCollateralAmountPerPool[delegationIntent.poolId] += delegationIntent
            .collateralDeltaAmountD18;

        if (!self.delegatedPools.contains(delegationIntent.poolId)) {
            self.delegatedPools.add(delegationIntent.poolId);
        }

        if (!self.delegatedCollaterals.contains(delegationIntent.collateralType)) {
            self.delegatedCollaterals.add(delegationIntent.collateralType);
        }

        self.netAcountCachedDelegatedCollateral += delegationIntent.collateralDeltaAmountD18;
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

        if (delegationIntent.collateralDeltaAmountD18 >= 0) {
            self.delegatedAmountPerCollateral[delegationIntent.collateralType] -= delegationIntent
                .collateralDeltaAmountD18
                .toUint();
            self.delegatedCollateralAmountPerPool[delegationIntent.poolId] -= delegationIntent
                .collateralDeltaAmountD18
                .toUint();
            self.delegateAcountCachedCollateral -= delegationIntent
                .collateralDeltaAmountD18
                .toUint();
        } else {
            self.undelegatedAmountPerCollateral[
                delegationIntent.collateralType
            ] -= (delegationIntent.collateralDeltaAmountD18 * -1).toUint();
            self.undelegatedCollateralAmountPerPool[delegationIntent.poolId] -= (delegationIntent
                .collateralDeltaAmountD18 * -1).toUint();
            self.undelegateAcountCachedCollateral -= (delegationIntent.collateralDeltaAmountD18 *
                -1).toUint();
        }
        self.netDelegatedAmountPerCollateral[delegationIntent.collateralType] -= delegationIntent
            .collateralDeltaAmountD18;
        self.netDelegatedCollateralAmountPerPool[delegationIntent.poolId] -= delegationIntent
            .collateralDeltaAmountD18;

        self.netAcountCachedDelegatedCollateral -= delegationIntent.collateralDeltaAmountD18;
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

    /**
     * @dev Cleans all intents related to the account. This should be called upon liquidation.
     */
    function cleanAllIntents(Data storage self) internal {
        uint256[] memory intentIds = self.intentsId.values();
        for (uint256 i = 0; i < intentIds.length; i++) {
            DelegationIntent.Data storage intent = DelegationIntent.load(intentIds[i]);
            removeIntent(self, intent);
        }

        self.netAcountCachedDelegatedCollateral = 0;
        self.delegateAcountCachedCollateral = 0;
        self.undelegateAcountCachedCollateral = 0;

        // Clear the cached collateral per pool
        uint256[] memory pools = self.delegatedPools.values();
        for (uint256 i = 0; i < pools.length; i++) {
            self.delegatedCollateralAmountPerPool[pools[i].to128()] = 0;
            self.undelegatedCollateralAmountPerPool[pools[i].to128()] = 0;
            self.netDelegatedCollateralAmountPerPool[pools[i].to128()] = 0;

            self.delegatedPools.remove(pools[i]);
        }

        // Clear the cached collateral per collateral
        address[] memory addresses = self.delegatedCollaterals.values();
        for (uint256 i = 0; i < addresses.length; i++) {
            self.delegatedAmountPerCollateral[addresses[i]] = 0;
            self.undelegatedAmountPerCollateral[addresses[i]] = 0;
            self.netDelegatedAmountPerCollateral[addresses[i]] = 0;

            self.delegatedCollaterals.remove(addresses[i]);
        }
    }
}
