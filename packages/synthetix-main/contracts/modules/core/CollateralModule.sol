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
 * @title See {ICollateralModule}
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

    error InvalidCollateral(address collateralType);

    // 86400 * 365.26
    uint private constant _SECONDS_PER_YEAR = 31558464;

    error OutOfBounds();

    error InsufficientAccountCollateral(uint amount);

    /**
     * @dev See {ICollateralModule-configureCollateral}.
     */
    function configureCollateral(CollateralConfiguration.Data memory config) external override {
        OwnableStorage.onlyOwner();
        CollateralConfiguration.set(config);
        emit CollateralConfigured(config.tokenAddress, config);
    }

    /**
     * @dev See {ICollateralModule-getCollateralConfigurations}.
     */
    function getCollateralConfigurations(bool hideDisabled)
        external
        view
        override
        returns (CollateralConfiguration.Data[] memory)
    {
        SetUtil.AddressSet storage collateralTypes = CollateralConfiguration.loadAvailableCollaterals();

        uint numCollaterals = collateralTypes.length();
        CollateralConfiguration.Data[] memory filteredCollaterals = new CollateralConfiguration.Data[](numCollaterals);

        uint collateralsIdx;
        for (uint i = 1; i <= numCollaterals; i++) {
            address collateralType = collateralTypes.valueAt(i);

            CollateralConfiguration.Data storage collateral = CollateralConfiguration.load(collateralType);

            if (!hideDisabled || collateral.depositingEnabled) {
                filteredCollaterals[collateralsIdx++] = collateral;
            }
        }

        return filteredCollaterals;
    }

    /**
     * @dev See {ICollateralModule-getCollateralConfiguration}.
     */
    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function getCollateralConfiguration(address collateralType)
        external
        view
        override
        returns (CollateralConfiguration.Data memory)
    {
        return CollateralConfiguration.load(collateralType);
    }

    function getCollateralPrice(address collateralType) external view override returns (uint) {
        return CollateralConfiguration.getCollateralPrice(CollateralConfiguration.load(collateralType));
    }

    /////////////////////////////////////////////////
    // DEPOSIT  /  WITHDRAW
    /////////////////////////////////////////////////

    /**
     * @dev See {ICollateralModule-deposit}.
     */
    function deposit(
        uint128 accountId,
        address collateralType,
        uint tokenAmount
    ) public override {
        CollateralConfiguration.collateralEnabled(collateralType);

        Account.Data storage account = Account.load(accountId);

        address depositFrom = msg.sender;

        address self = address(this);

        uint allowance = IERC20(collateralType).allowance(depositFrom, self);
        if (allowance < amount) {
            revert IERC20.InsufficientAllowance(amount, allowance);
        }

        collateralType.safeTransferFrom(depositFrom, self, amount);

        account.collaterals[collateralType].deposit(_convertTokenToSystemAmount(tokenAddress));

        emit Deposited(accountId, collateralType, tokenAmount, msg.sender);
    }

    /**
     * @dev See {ICollateralModule-Withdraw}.
     */
    function withdraw(
        uint128 accountId,
        address collateralType,
        uint tokenAmount
    ) public override {
        Account.onlyWithPermission(accountId, AccountRBAC._WITHDRAW_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        // this extra condition is to prevent potentially malicious untrusted code from being executed on the next statement
        if (account.collaterals[collateralType].availableAmountD18 == 0) {
            revert InsufficientAccountCollateral(0);
        }

        uint systemAmount = _convertTokenToSystemAmount(collateralType, tokenAmount);

        if (account.collaterals[collateralType].availableAmountD18 < systemAmount) {
            revert InsufficientAccountCollateral(systemAmount);
        }

        account.collaterals[collateralType].deductCollateral(systemAmount);

        collateralType.safeTransfer(msg.sender, tokenAmount);

        emit Withdrawn(accountId, collateralType, tokenAmount, msg.sender);
    }

    /**
     * @dev See {ICollateralModule-getAccountCollateral}.
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
     * @dev See {ICollateralModule-getAccountAvailableCollateral}.
     */
    function getAccountAvailableCollateral(uint128 accountId, address collateralType) public view override returns (uint) {
        return Account.load(accountId).collaterals[collateralType].availableAmountD18;
    }

    /**
     * @dev See {ICollateralModule-cleanExpiredLocks}.
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
            // not specified, use all array
            items = locks.length;
        }

        uint index = offset;
        while (index < locks.length) {
            if (locks[index].lockExpirationTime <= currentTime) {
                // remove item
                locks[index] = locks[locks.length - 1];
                locks.pop();
            } else {
                index++;
            }
        }
    }

    /**
     * @dev See {ICollateralModule-createLock}.
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

    function _convertTokenToSystemAmount(IERC20 token, uint tokenAmount) internal view {
        return tokenAmount * DecimalMath.UNIT / 10 ** token.decimals();
    }
}
