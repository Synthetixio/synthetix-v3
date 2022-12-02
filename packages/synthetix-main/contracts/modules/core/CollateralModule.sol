//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";

import "../../interfaces/ICollateralModule.sol";

import "../../storage/Account.sol";
import "../../storage/CollateralConfiguration.sol";
import "../../storage/CollateralLock.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

/**
 * @title TODO
 *
 * TODO: Consider splitting this into CollateralConfigurationModule and CollateralModule.
 * The former is for owner only stuff, and the latter for users.
 */
contract CollateralModule is ICollateralModule {
    using SetUtil for SetUtil.AddressSet;
    using ERC20Helper for address;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Account for Account.Data;
    using AccountRBAC for AccountRBAC.Data;
    using Collateral for Collateral.Data;

    error OutOfBounds();
    error InsufficientAccountCollateral(uint amount);

    /**
     * @dev Allows an account to deposit collateral in the system.
     */
    function deposit(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override {
        CollateralConfiguration.collateralEnabled(collateralType);
        Account.onlyWithPermission(accountId, AccountRBAC._DEPOSIT_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        // TODO: Deposit/withdraw should be transferring from/to msg.sender,
        // instead of the account's owner address.
        // If msg.sender has permission for a deposit/withdraw operation,
        // then it is most natural for the collateral to be pulled from msg.sender.
        address user = account.rbac.owner;

        address self = address(this);

        uint allowance = IERC20(collateralType).allowance(user, self);
        if (allowance < amount) {
            revert IERC20.InsufficientAllowance(amount, allowance);
        }

        collateralType.safeTransferFrom(user, self, amount);

        account.collaterals[collateralType].deposit(amount);

        emit Deposited(accountId, collateralType, amount, msg.sender);
    }

    /**
     * @dev Allows an account to withdraw collateral from the system.
     */
    function withdraw(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override {
        Account.onlyWithPermission(accountId, AccountRBAC._WITHDRAW_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        if (account.collaterals[collateralType].availableAmountD18 < amount) {
            revert InsufficientAccountCollateral(amount);
        }

        account.collaterals[collateralType].deductCollateral(amount);

        collateralType.safeTransfer(account.rbac.owner, amount);

        emit Withdrawn(accountId, collateralType, amount, msg.sender);
    }

    /**
     * @dev Returns an accounts total deposited collateral for a given type.
     */
    function getAccountCollateral(uint128 accountId, address collateralType)
        external
        view
        override
        returns (
            uint256 totalDeposited,
            uint256 totalAssigned,
            uint256 totalLocked
        )
    {
        return Account.load(accountId).getCollateralTotals(collateralType);
    }

    /**
     * @dev Returns an account's collateral that can be withdrawn or delegated to pools.
     */
    function getAccountAvailableCollateral(uint128 accountId, address collateralType) public view override returns (uint) {
        return Account.load(accountId).collaterals[collateralType].availableAmountD18;
    }

    /**
     * @dev Unlocks collateral locks that have expired.
     *
     * See `CollateralModule.createLock()`.
     *
     * Note: If offset and items are not specified, assume all locks.
     */
    function cleanExpiredLocks(
        uint128 accountId,
        address collateralType,
        uint offset,
        uint items
    ) external override {
        CollateralLock.Data[] storage locks = Account.load(accountId).collaterals[collateralType].locks;

        if (offset > locks.length || items > locks.length) {
            revert OutOfBounds();
        }

        uint64 currentTime = uint64(block.timestamp);

        if (offset == 0 && items == 0) {
            items = locks.length;
        }

        uint index = offset;
        while (index < locks.length) {
            if (locks[index].lockExpirationTime <= currentTime) {
                locks[index] = locks[locks.length - 1];
                locks.pop();
            } else {
                index++;
            }
        }
    }

    /**
     * @dev Create a collateral lock for the given account.
     *
     * Note: A collateral lock does not affect withdrawals, but instead affects collateral delegation.
     */
    function createLock(
        uint128 accountId,
        address collateralType,
        uint amount,
        uint64 expireTimestamp
    ) external override {
        Account.onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        (uint totalStaked, , uint totalLocked) = account.getCollateralTotals(collateralType);

        if (totalStaked - totalLocked < amount) {
            revert InsufficientAccountCollateral(amount);
        }

        account.collaterals[collateralType].locks.push(CollateralLock.Data(amount, expireTimestamp));
    }
}
