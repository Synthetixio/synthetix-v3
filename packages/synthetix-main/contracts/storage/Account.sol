//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AccountRBAC.sol";
import "./Collateral.sol";

import "./Pool.sol";

library Account {
    using AccountRBAC for AccountRBAC.Data;
    using Pool for Pool.Data;
    using Collateral for Collateral.Data;
    using SetUtil for SetUtil.UintSet;

    error PermissionDenied(uint128 accountId, bytes32 permission, address target);
    error InsufficientAccountCollateral(uint requestedAmount);

    struct Data {
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

    function getCollateralTotals(Data storage self, address collateralType)
        internal
        view
        returns (
            uint256 totalDeposited,
            uint256 totalAssigned,
            uint256 totalLocked
        )
    {
        totalAssigned = getAssignedCollateral(self, collateralType);
        totalDeposited = totalAssigned + self.collaterals[collateralType].availableAmountD18;
        totalLocked = self.collaterals[collateralType].getTotalLocked();
        //totalEscrowed = _getLockedEscrow(stakedCollateral.escrow);

        return (totalDeposited, totalAssigned, totalLocked); //, totalEscrowed);
    }

    function getAssignedCollateral(Data storage self, address collateralType) internal view returns (uint) {
        uint totalAssignedD18 = 0;

        SetUtil.UintSet storage pools = self.collaterals[collateralType].pools;

        for (uint i = 1; i <= pools.length(); i++) {
            uint128 poolIdx = uint128(pools.valueAt(i));

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
        uint amount
    ) internal view {
        if (Account.load(accountId).collaterals[collateralType].availableAmountD18 < amount) {
            revert InsufficientAccountCollateral(amount);
        }
    }
}
