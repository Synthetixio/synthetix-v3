//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./AccountRBAC.sol";
import "./Collateral.sol";
import "./Pool.sol";

import "../interfaces/ICollateralModule.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

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
     * @dev Thrown when the requested operation requires an activity timeout before the
     */
    error AccountActivityTimeoutPending(
        uint128 accountId,
        uint256 currentTime,
        uint256 requiredTime
    );

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
        uint64 lastInteraction;
        uint64 __slotAvailableForFutureUse;
        uint128 __slot2AvailableForFutureUse;
        /**
         * @dev Address set of collaterals that are being used in the system by this account.
         */
        mapping(address => Collateral.Data) collaterals;
    }

    /**
     * @dev Returns the account stored at the specified account id.
     */
    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Account", id));
        assembly {
            account.slot := s
        }
    }

    /**
     * @dev Creates an account for the given id, and associates it to the given owner.
     *
     * Note: Will not fail if the account already exists, and if so, will overwrite the existing owner. Whatever calls this internal function must first check that the account doesn't exist before re-creating it.
     */
    function create(uint128 id, address owner) internal returns (Data storage account) {
        account = load(id);

        account.id = id;
        account.rbac.owner = owner;
    }

    /**
     * @dev Reverts if the account does not exist with appropriate error. Otherwise, returns the account.
     */
    function exists(uint128 id) internal view returns (Data storage account) {
        Data storage a = load(id);
        if (a.rbac.owner == address(0)) {
            revert AccountNotFound(id);
        }

        return a;
    }

    /**
     * @dev Given a collateral type, returns information about the total collateral assigned, deposited, and locked by the account
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
        totalDepositedD18 =
            totalAssignedD18 +
            self.collaterals[collateralType].amountAvailableForDelegationD18;
        totalLockedD18 = self.collaterals[collateralType].getTotalLocked();

        return (totalDepositedD18, totalAssignedD18, totalLockedD18);
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

    function recordInteraction(Data storage self) internal {
        // solhint-disable-next-line numcast/safe-cast
        self.lastInteraction = uint64(block.timestamp);
    }

    /**
     * @dev Loads the Account object for the specified accountId,
     * and validates that sender has the specified permission. It also resets
     * the interaction timeout. These
     * are different actions but they are merged in a single function
     * because loading an account and checking for a permission is a very
     * common use case in other parts of the code.
     */
    function loadAccountAndValidatePermission(
        uint128 accountId,
        bytes32 permission
    ) internal returns (Data storage account) {
        account = Account.load(accountId);

        if (!account.rbac.authorized(permission, ERC2771Context._msgSender())) {
            revert PermissionDenied(accountId, permission, ERC2771Context._msgSender());
        }

        recordInteraction(account);
    }

    /**
     * @dev Loads the Account object for the specified accountId,
     * and validates that sender has the specified permission. It also resets
     * the interaction timeout. These
     * are different actions but they are merged in a single function
     * because loading an account and checking for a permission is a very
     * common use case in other parts of the code.
     */
    function loadAccountAndValidatePermissionAndTimeout(
        uint128 accountId,
        bytes32 permission,
        uint256 timeout
    ) internal view returns (Data storage account) {
        account = Account.load(accountId);

        if (!account.rbac.authorized(permission, ERC2771Context._msgSender())) {
            revert PermissionDenied(accountId, permission, ERC2771Context._msgSender());
        }

        uint256 endWaitingPeriod = account.lastInteraction + timeout;
        if (block.timestamp < endWaitingPeriod) {
            revert AccountActivityTimeoutPending(accountId, block.timestamp, endWaitingPeriod);
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
        if (
            Account.load(accountId).collaterals[collateralType].amountAvailableForDelegationD18 <
            amountD18
        ) {
            revert ICollateralModule.InsufficientAccountCollateral(amountD18);
        }
    }
}
