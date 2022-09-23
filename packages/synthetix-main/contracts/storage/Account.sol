//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AccountRBAC.sol";
import "./Collateral.sol";

import "./Pool.sol";

library Account {
    using AccountRBAC for AccountRBAC.Data;
    using Pool for Pool.Data;
    using SetUtil for SetUtil.UintSet;

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
        returns (uint256 totalDeposited, uint256 totalAssigned)
    {
        totalAssigned = getAssignedCollateral(self, collateralType);
        totalDeposited = totalAssigned + self.collaterals[collateralType].availableAmount;
        //totalLocked = _getTotalLocked(stakedCollateral.locks);
        //totalEscrowed = _getLockedEscrow(stakedCollateral.escrow);

        return (totalDeposited, totalAssigned); //, totalLocked, totalEscrowed);
    }

    function getAssignedCollateral(Data storage self, address collateralType) internal view returns (uint) {
        uint totalAssigned = 0;

        uint[] memory pools = self.collaterals[collateralType].pools.values();

        console.log("GETTING ASSIGNED", pools.length);
        for (uint i = 0; i < pools.length; i++) {
            uint128 poolIdx = uint128(pools[i]);

            Pool.Data storage pool = Pool.load(poolIdx);

            (uint collateralAmount,,) = pool.currentAccountCollateral(collateralType, self.id);
            totalAssigned += collateralAmount;
            console.log("ASSIGNED", collateralAmount, self.id);
        }

        return totalAssigned;
    }
}