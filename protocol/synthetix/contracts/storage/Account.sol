//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AccountRBAC.sol";
import "./Collateral.sol";
import "./Pool.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Object for tracking accounts with access control and collateral tracking.
 */
library Account {
    using AccountRBAC for AccountRBAC.Data;
    using Pool for Pool.Data;
    using Collateral for Collateral.Data;
    using SetUtil for SetUtil.UintSet;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    /**
     * @dev Thrown when the given target address does not have the given permission with the given account.
     */
    error PermissionDenied(uint128 accountId, bytes32 permission, address target);

    /**
     * @dev Thrown when an account cannot be found.
     */
    error AccountNotFound(uint128 accountId);

    /**
     * @dev Thrown when an account does not have sufficient collateral for a particular operation in the system.
     */
    error InsufficientAccountCollateral(uint256 requestedAmount);

    /**
     * @dev Thrown when a permission specified by a user does not exist or is invalid.
     */
    error InvalidPermission(bytes32 permission);

    struct Data {
        /**
         * @dev Numeric identifier for the account. Must be unique.
         * @dev There cannot be an account with id zero (See ERC721._mint()).
         */
        uint128 id;
        /**
         * @dev Role based access control data for the account.
         */
        AccountRBAC.Data rbac;
        // solhint-disable-next-line private-vars-leading-underscore
        bytes32 __slotAvailableForFutureUse;
        /**
         * @dev Address set of collaterals that are being used in the system by this account.
         */
        mapping(address => Collateral.Data) collaterals;
    }

    /**
     * @dev Returns the account stored at the specified account id.
     */
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Account", id));
        assembly {
            data.slot := s
        }
    }

    /**
     * @dev Creates an account for the given id, and associates it to the given owner.
     *
     * Note: Will not fail if the account already exists, and if so, will overwrite the existing owner. Whatever calls this internal function must first check that the account doesn't exist before re-creating it.
     */
    function create(uint128 id, address owner) internal returns (Data storage self) {
        self = load(id);

        self.id = id;
        self.rbac.owner = owner;
    }

    /**
     * @dev Returns if an account exists for the given id.
     */
    function exists(uint128 id) internal view {
        if (load(id).rbac.owner == address(0)) {
            revert AccountNotFound(id);
        }
    }

    /**
     * @dev Returns information about the total collateral assigned, deposited, and locked by the account, and the given collateral type.
     */
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

        return (totalDepositedD18, totalAssignedD18, totalLockedD18); //, totalEscrowed);
    }

    /**
     * @dev Returns the total amount of collateral that has been delegated to pools by the account, for the given collateral type.
     */
    function getAssignedCollateral(
        Data storage self,
        address collateralType
    ) internal view returns (uint256) {
        uint256 totalAssignedD18 = 0;

        SetUtil.UintSet storage pools = self.collaterals[collateralType].pools;

        for (uint256 i = 1; i <= pools.length(); i++) {
            uint128 poolIdx = pools.valueAt(i).to128();

            Pool.Data storage pool = Pool.load(poolIdx);

            (uint256 collateralAmountD18, ) = pool.currentAccountCollateral(
                collateralType,
                self.id
            );
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
     * @dev Ensure that the account has the required amount of collateral funds remaining
     */
    function requireSufficientCollateral(
        uint128 accountId,
        address collateralType,
        uint256 amountD18
    ) internal view {
        if (Account.load(accountId).collaterals[collateralType].availableAmountD18 < amountD18) {
            revert InsufficientAccountCollateral(amountD18);
        }
    }
}
