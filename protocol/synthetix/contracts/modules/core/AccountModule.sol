//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../interfaces/IAccountModule.sol";
import "../../interfaces/IAccountTokenModule.sol";
import "../../storage/Account.sol";
import "../../storage/SystemAccountConfiguration.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

/**
 * @title Module for managing accounts.
 * @dev See IAccountModule.
 */
contract AccountModule is IAccountModule {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;
    using AccountRBAC for AccountRBAC.Data;
    using Account for Account.Data;

    bytes32 private constant _ACCOUNT_SYSTEM = "accountNft";

    bytes32 private constant _CREATE_ACCOUNT_FEATURE_FLAG = "createAccount";

    /**
     * @inheritdoc IAccountModule
     */
    function getAccountTokenAddress() public view override returns (address) {
        return AssociatedSystem.load(_ACCOUNT_SYSTEM).proxy;
    }

    /**
     * @inheritdoc IAccountModule
     */
    function getAccountPermissions(
        uint128 accountId
    ) external view returns (AccountPermissions[] memory accountPerms) {
        AccountRBAC.Data storage accountRbac = Account.load(accountId).rbac;

        uint256 allPermissionsLength = accountRbac.permissionAddresses.length();
        accountPerms = new AccountPermissions[](allPermissionsLength);
        for (uint256 i = 1; i <= allPermissionsLength; i++) {
            address permissionAddress = accountRbac.permissionAddresses.valueAt(i);
            accountPerms[i - 1] = AccountPermissions({
                user: permissionAddress,
                permissions: accountRbac.permissions[permissionAddress].values()
            });
        }
    }

    /**
     * @inheritdoc IAccountModule
     */
    function createAccount(uint128 requestedAccountId) external override {
        FeatureFlag.ensureAccessToFeature(_CREATE_ACCOUNT_FEATURE_FLAG);

        if (requestedAccountId >= type(uint128).max / 2) {
            revert InvalidAccountId(requestedAccountId);
        }

        IAccountTokenModule accountTokenModule = IAccountTokenModule(getAccountTokenAddress());
        accountTokenModule.safeMint(ERC2771Context._msgSender(), requestedAccountId, "");

        Account.create(requestedAccountId, ERC2771Context._msgSender());

        emit AccountCreated(requestedAccountId, ERC2771Context._msgSender());
    }

    /**
     * @inheritdoc IAccountModule
     */
    function createAccount() external override returns (uint128 accountId) {
        FeatureFlag.ensureAccessToFeature(_CREATE_ACCOUNT_FEATURE_FLAG);

        IAccountTokenModule accountTokenModule = IAccountTokenModule(getAccountTokenAddress());

        SystemAccountConfiguration.Data
            storage systemAccountConfiguration = SystemAccountConfiguration.load();
        accountId = (type(uint128).max / 2) + systemAccountConfiguration.accountIdOffset;
        systemAccountConfiguration.accountIdOffset += 1;

        Account.create(accountId, ERC2771Context._msgSender());

        accountTokenModule.safeMint(ERC2771Context._msgSender(), accountId, "");

        emit AccountCreated(accountId, ERC2771Context._msgSender());
    }

    /**
     * @inheritdoc IAccountModule
     */
    function notifyAccountTransfer(address to, uint128 accountId) external override {
        _onlyAccountToken();

        Account.Data storage account = Account.load(accountId);

        address[] memory permissionedAddresses = account.rbac.permissionAddresses.values();
        for (uint256 i = 0; i < permissionedAddresses.length; i++) {
            account.rbac.revokeAllPermissions(permissionedAddresses[i]);
        }

        account.rbac.setOwner(to);
    }

    /**
     * @inheritdoc IAccountModule
     */
    function hasPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.hasPermission(permission, user);
    }

    /**
     * @inheritdoc IAccountModule
     */
    function isAuthorized(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.authorized(permission, user);
    }

    /**
     * @inheritdoc IAccountModule
     */
    function grantPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) external override {
        AccountRBAC.isPermissionValid(permission);

        Account.Data storage account = Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._ADMIN_PERMISSION
        );

        account.rbac.grantPermission(permission, user);

        emit PermissionGranted(accountId, permission, user, ERC2771Context._msgSender());
    }

    /**
     * @inheritdoc IAccountModule
     */
    function revokePermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) external override {
        Account.Data storage account = Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._ADMIN_PERMISSION
        );

        account.rbac.revokePermission(permission, user);

        emit PermissionRevoked(accountId, permission, user, ERC2771Context._msgSender());
    }

    /**
     * @inheritdoc IAccountModule
     */
    function renouncePermission(uint128 accountId, bytes32 permission) external override {
        if (!Account.load(accountId).rbac.hasPermission(permission, ERC2771Context._msgSender())) {
            revert PermissionNotGranted(accountId, permission, ERC2771Context._msgSender());
        }

        Account.load(accountId).rbac.revokePermission(permission, ERC2771Context._msgSender());

        emit PermissionRevoked(
            accountId,
            permission,
            ERC2771Context._msgSender(),
            ERC2771Context._msgSender()
        );
    }

    /**
     * @inheritdoc IAccountModule
     */
    function getAccountOwner(uint128 accountId) public view returns (address) {
        return Account.load(accountId).rbac.owner;
    }

    /**
     * @inheritdoc IAccountModule
     */
    function getAccountLastInteraction(uint128 accountId) external view returns (uint256) {
        return Account.load(accountId).lastInteraction;
    }

    /**
     * @dev Reverts if the caller is not the account token managed by this module.
     */
    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function _onlyAccountToken() internal view {
        if (ERC2771Context._msgSender() != address(getAccountTokenAddress())) {
            revert OnlyAccountTokenProxy(ERC2771Context._msgSender());
        }
    }
}
