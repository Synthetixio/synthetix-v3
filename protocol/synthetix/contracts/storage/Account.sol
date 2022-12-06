//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AccountRBAC.sol";
import "./Collateral.sol";
import "./Pool.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

library Account {
    using AccountRBAC for AccountRBAC.Data;
    using Pool for Pool.Data;
    using Collateral for Collateral.Data;
    using SetUtil for SetUtil.UintSet;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    error PermissionDenied(uint128 accountId, bytes32 permission, address target);
    error AccountNotFound(uint128 accountId);
    error InsufficientAccountCollateral(uint requestedAmount);

    struct Data {
        /**
         * @dev Numeric identifier for the account. Must be unique.
         * @dev There cannot be an account with id zero (See ERC721._mint()).
         */
        uint128 id;
        AccountRBAC.Data rbac;
        SetUtil.AddressSet activeCollaterals;
        mapping(address => Collateral.Data) collaterals;
    }

    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Account", id));
        assembly {
            data.slot := s
        }
    }

    function create(uint128 id, address owner) internal returns (Data storage self) {
        self = load(id);

        self.id = id;
        self.rbac.owner = owner;
    }

    function exists(uint128 id) internal view {
        if (load(id).rbac.owner == address(0)) {
            revert AccountNotFound(id);
        }
    }

    function getCollateralTotals(
        Data storage self,
        address collateralType
    )
        internal
        view
        returns (uint256 totalDepositedD18, uint256 totalAssignedD18, uint256 totalLockedD18)
    {
        totalAssignedD18 = getAssignedCollateral(self, collateralType);
        totalDepositedD18 = totalAssignedD18 + self.collaterals[collateralType].availableAmountD18;
        totalLockedD18 = self.collaterals[collateralType].getTotalLocked();
        //totalEscrowed = _getLockedEscrow(depositedCollateral.escrow);

        return (totalDepositedD18, totalAssignedD18, totalLockedD18); //, totalEscrowed);
    }

    function getAssignedCollateral(
        Data storage self,
        address collateralType
    ) internal view returns (uint) {
        uint totalAssignedD18 = 0;

        SetUtil.UintSet storage pools = self.collaterals[collateralType].pools;

        for (uint i = 1; i <= pools.length(); i++) {
            uint128 poolIdx = pools.valueAt(i).to128();

            Pool.Data storage pool = Pool.load(poolIdx);

            (uint collateralAmountD18, ) = pool.currentAccountCollateral(collateralType, self.id);
            totalAssignedD18 += collateralAmountD18;
        }

        return totalAssignedD18;
    }

    /**
     * @dev Requires that the given account has the specified permission.
     */
    function onlyWithPermission(uint128 accountId, bytes32 permission) internal view {
        if (!Account.load(accountId).rbac.authorized(permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }
    }

    /**
     * Ensure that the account has the required amount of collateral funds remaining
     */
    function requireSufficientCollateral(
        uint128 accountId,
        address collateralType,
        uint amountD18
    ) internal view {
        if (Account.load(accountId).collaterals[collateralType].availableAmountD18 < amountD18) {
            revert InsufficientAccountCollateral(amountD18);
        }
    }
}
