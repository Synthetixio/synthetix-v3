//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";
import "@synthetixio/core-contracts/contracts/errors/ArrayError.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "../../interfaces/ICollateralModule.sol";

import "../../storage/Account.sol";
import "../../storage/CollateralConfiguration.sol";
import "../../storage/Config.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

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
    using SafeCastU256 for uint256;

    bytes32 private constant _DEPOSIT_FEATURE_FLAG = "deposit";
    bytes32 private constant _WITHDRAW_FEATURE_FLAG = "withdraw";
    bytes32 private constant _CONFIG_TIMEOUT_WITHDRAW = "accountTimeoutWithdraw";

    /**
     * @inheritdoc ICollateralModule
     */
    function deposit(
        uint128 accountId,
        address collateralType,
        uint256 tokenAmount
    ) external override {
        FeatureFlag.ensureAccessToFeature(_DEPOSIT_FEATURE_FLAG);
        CollateralConfiguration.collateralEnabled(collateralType);
        Account.exists(accountId);

        Account.Data storage account = Account.load(accountId);

        address depositFrom = ERC2771Context._msgSender();

        address self = address(this);

        uint256 allowance = IERC20(collateralType).allowance(depositFrom, self);
        if (allowance < tokenAmount) {
            revert IERC20.InsufficientAllowance(tokenAmount, allowance);
        }

        collateralType.safeTransferFrom(depositFrom, self, tokenAmount);

        account.collaterals[collateralType].increaseAvailableCollateral(
            CollateralConfiguration.load(collateralType).convertTokenToSystemAmount(tokenAmount)
        );

        emit Deposited(accountId, collateralType, tokenAmount, ERC2771Context._msgSender());
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function withdraw(
        uint128 accountId,
        address collateralType,
        uint256 tokenAmount
    ) external override {
        FeatureFlag.ensureAccessToFeature(_WITHDRAW_FEATURE_FLAG);
        Account.Data storage account = Account.loadAccountAndValidatePermissionAndTimeout(
            accountId,
            AccountRBAC._WITHDRAW_PERMISSION,
            Config.readUint(_CONFIG_TIMEOUT_WITHDRAW, 0)
        );

        uint256 tokenAmountD18 = CollateralConfiguration
            .load(collateralType)
            .convertTokenToSystemAmount(tokenAmount);

        (uint256 totalDeposited, uint256 totalAssigned, uint256 totalLocked) = account
            .getCollateralTotals(collateralType);

        // The amount that cannot be withdrawn from the protocol is the max of either
        // locked collateral or delegated collateral.
        uint256 unavailableCollateral = totalLocked > totalAssigned ? totalLocked : totalAssigned;

        uint256 availableForWithdrawal = totalDeposited - unavailableCollateral;
        if (tokenAmountD18 > availableForWithdrawal) {
            revert InsufficientAccountCollateral(tokenAmountD18);
        }

        account.collaterals[collateralType].decreaseAvailableCollateral(tokenAmountD18);

        collateralType.safeTransfer(ERC2771Context._msgSender(), tokenAmount);

        emit Withdrawn(accountId, collateralType, tokenAmount, ERC2771Context._msgSender());
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
    ) public view override returns (uint256) {
        return Account.load(accountId).collaterals[collateralType].amountAvailableForDelegationD18;
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function cleanExpiredLocks(
        uint128 accountId,
        address collateralType,
        uint256 offset,
        uint256 count
    ) external override returns (uint256 cleared) {
        CollateralLock.Data[] storage locks = Account
            .load(accountId)
            .collaterals[collateralType]
            .locks;

        uint64 currentTime = block.timestamp.to64();

        uint256 len = locks.length;

        if (offset >= len) {
            return 0;
        }

        if (count == 0 || offset + count >= len) {
            count = len - offset;
        }

        uint256 index = offset;
        for (uint256 i = 0; i < count; i++) {
            if (locks[index].lockExpirationTime <= currentTime) {
                emit CollateralLockExpired(
                    accountId,
                    collateralType,
                    locks[index].amountD18,
                    locks[index].lockExpirationTime
                );

                locks[index] = locks[locks.length - 1];
                locks.pop();
            } else {
                index++;
            }
        }

        return count + offset - index;
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function getLocks(
        uint128 accountId,
        address collateralType,
        uint256 offset,
        uint256 count
    ) external view override returns (CollateralLock.Data[] memory locks) {
        CollateralLock.Data[] storage storageLocks = Account
            .load(accountId)
            .collaterals[collateralType]
            .locks;
        uint256 len = storageLocks.length;

        if (count == 0 || offset + count >= len) {
            count = offset < len ? len - offset : 0;
        }

        locks = new CollateralLock.Data[](count);

        for (uint256 i = 0; i < count; i++) {
            locks[i] = storageLocks[offset + i];
        }
    }

    /**
     * @inheritdoc ICollateralModule
     */
    function createLock(
        uint128 accountId,
        address collateralType,
        uint256 amount,
        uint64 expireTimestamp
    ) external override {
        Account.Data storage account = Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._ADMIN_PERMISSION
        );

        (uint256 totalDeposited, , uint256 totalLocked) = account.getCollateralTotals(
            collateralType
        );

        if (expireTimestamp <= block.timestamp) {
            revert ParameterError.InvalidParameter("expireTimestamp", "must be in the future");
        }

        if (amount == 0) {
            revert ParameterError.InvalidParameter("amount", "must be nonzero");
        }

        if (amount > totalDeposited - totalLocked) {
            revert InsufficientAccountCollateral(amount);
        }

        account.collaterals[collateralType].locks.push(
            CollateralLock.Data(amount.to128(), expireTimestamp)
        );

        emit CollateralLockCreated(accountId, collateralType, amount, expireTimestamp);
    }
}
