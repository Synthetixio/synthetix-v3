//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../interfaces/ICollateralModule.sol";

import "../../storage/Account.sol";
import "../../storage/CollateralConfiguration.sol";
import "../../storage/CollateralLock.sol";

/**
 * @title Module for managing user collateral.
 * @dev See ICollateralModule.
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
     * @inheritdoc ICollateralModule
     */
    function deposit(uint128 accountId, address collateralType, uint tokenAmount) public override {
        CollateralConfiguration.collateralEnabled(collateralType);

        Account.Data storage account = Account.load(accountId);

        address depositFrom = msg.sender;

        address self = address(this);

        uint allowance = IERC20(collateralType).allowance(depositFrom, self);
        if (allowance < tokenAmount) {
            revert IERC20.InsufficientAllowance(tokenAmount, allowance);
        }

        collateralType.safeTransferFrom(depositFrom, self, tokenAmount);

        account.collaterals[collateralType].deposit(
            CollateralConfiguration.load(collateralType).convertTokenToSystemAmount(tokenAmount)
        );

        emit Deposited(accountId, collateralType, tokenAmount, msg.sender);
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function withdraw(uint128 accountId, address collateralType, uint tokenAmount) public override {
        Account.onlyWithPermission(accountId, AccountRBAC._WITHDRAW_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        uint systemAmount = CollateralConfiguration.load(collateralType).convertTokenToSystemAmount(
            tokenAmount
        );

        if (account.collaterals[collateralType].availableAmountD18 < systemAmount) {
            revert InsufficientAccountCollateral(systemAmount);
        }

        account.collaterals[collateralType].deductCollateral(systemAmount);

        collateralType.safeTransfer(msg.sender, tokenAmount);

        emit Withdrawn(accountId, collateralType, tokenAmount, msg.sender);
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function getAccountCollateral(
        uint128 accountId,
        address collateralType
    )
        external
        view
        override
        returns (uint256 totalDeposited, uint256 totalAssigned, uint256 totalLocked)
    {
        return Account.load(accountId).getCollateralTotals(collateralType);
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function getAccountAvailableCollateral(
        uint128 accountId,
        address collateralType
    ) public view override returns (uint) {
        return Account.load(accountId).collaterals[collateralType].availableAmountD18;
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function cleanExpiredLocks(
        uint128 accountId,
        address collateralType,
        uint offset,
        uint items
    ) external override {
        CollateralLock.Data[] storage locks = Account
            .load(accountId)
            .collaterals[collateralType]
            .locks;

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
     * @inheritdoc ICollateralModule
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

        account.collaterals[collateralType].locks.push(
            CollateralLock.Data(amount, expireTimestamp)
        );
    }
}
