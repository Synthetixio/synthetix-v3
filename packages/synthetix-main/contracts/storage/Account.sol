//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AccountRBAC.sol";
import "./Collateral.sol";

import "./Pool.sol";

library Account {
    using AccountRBAC for AccountRBAC.Data;
    using Pool for Pool.Data;

    error PermissionDenied(uint128 accountId, bytes32 permission, address target);

    struct Data {
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

    modifier onlyWithPermission(uint128 accountId, bytes32 permission) {
        if (!load(accountId).rbac.authorized(permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }

    function getCollateralTotals(uint128 accountId, address collateralType)
        internal
        view
        returns (uint256 totalDeposited, uint256 totalAssigned)
    {
        Data storage self = load(accountId);
        
        totalAssigned = getAssignedCollateral(accountId, collateralType);
        totalDeposited = totalAssigned + self.collaterals[collateralType].availableAmount;
        //totalLocked = _getTotalLocked(stakedCollateral.locks);
        //totalEscrowed = _getLockedEscrow(stakedCollateral.escrow);

        return (totalDeposited, totalAssigned); //, totalLocked, totalEscrowed);
    }

    function getAssignedCollateral(uint128 accountId, address collateralType) internal view returns (uint) {
        Data storage self = load(accountId);

        uint totalAssigned = 0;
        for (uint i = 0; i < self.collaterals[collateralType].pools.length; i++) {
            uint128 poolIdx = self.collaterals[collateralType].pools[i];

            Pool.Data storage poolData = Pool.load(poolIdx);

            (uint collateralAmount,,) = poolData.currentAccountCollateral(collateralType, accountId);
            totalAssigned += collateralAmount;
        }

        return totalAssigned;
    }
}