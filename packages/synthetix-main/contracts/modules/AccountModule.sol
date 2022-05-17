//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/IAccountModule.sol";
import "../storage/AccountModuleStorage.sol";

import "../satellites/AccountToken.sol";
import "../mixins/AccountRBACMixin.sol";

contract AccountModule is IAccountModule, OwnableMixin, AccountRBACMixin, InitializableMixin, SatelliteFactory {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;

    event AccountCreated(address accountAddress);

    event RoleGranted(uint accountId, bytes32 role, address target, address executedBy);
    event RoleRevoked(uint accountId, bytes32 role, address target, address executedBy);

    error OnlyTokenProxyAllowed(address origin);
    error InvalidRole();

    // ---------------------------------------
    // Chores
    // ---------------------------------------
    function _isInitialized() internal view override returns (bool) {
        return _accountModuleStore().initialized;
    }

    function isAccountModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeAccountModule() external override onlyOwner onlyIfNotInitialized {
        AccountModuleStore storage store = _accountModuleStore();

        AccountToken account = new AccountToken();

        UUPSProxy accountProxy = new UUPSProxy(address(account));

        address accountProxyAddress = address(accountProxy);

        account.nominateNewOwner(address(this));
        account.acceptOwnership();
        account.initialize("Synthetix Account", "synthethixAccount", "", address(this));

        store.account = Satellite({
            name: "synthethixAccount",
            contractName: "Account",
            deployedAddress: accountProxyAddress
        });

        store.initialized = true;

        emit AccountCreated(accountProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _accountModuleStore().account;
        return satellites;
    }

    function getAccountModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function upgradeAccountImplementation(address newAccountTokenImplementation)
        external
        override
        onlyOwner
        onlyIfInitialized
    {
        AccountToken(getAccountAddress()).upgradeTo(newAccountTokenImplementation);
    }

    function getAccountAddress() public view override returns (address) {
        return _accountModuleStore().account.deployedAddress;
    }

    // ---------------------------------------
    // Business Logic
    // ---------------------------------------
    function mintAccount(uint256 accountId) external override {
        AccountToken(getAccountAddress()).mint(msg.sender, accountId);

        _accountModuleStore().accountsRBAC[accountId].owner = msg.sender;
    }

    function transferAccount(address to, uint256 accountId) external override onlyFromTokenProxy {
        _accountModuleStore().accountsRBAC[accountId].owner = to;
    }

    function hasRole(
        uint256 accountId,
        bytes32 role,
        address target
    ) public view override returns (bool) {
        return _hasRole(accountId, role, target);
    }

    function grantRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override onlyRoleAuthorized(accountId, "modifyPermission") {
        if (target == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (role == "") {
            revert InvalidRole();
        }

        AccountRBAC storage accountRbac = _accountModuleStore().accountsRBAC[accountId];

        if (!accountRbac.permissionAddresses.contains(target)) {
            accountRbac.permissionAddresses.add(target);
        }

        accountRbac.permissions[target].add(role);

        emit RoleGranted(accountId, role, target, msg.sender);
    }

    function revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override onlyRoleAuthorized(accountId, "modifyPermission") {
        _revokeRole(accountId, role, target);
    }

    function renounceRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override {
        if (msg.sender != target) {
            revert RoleNotAuthorized(accountId, "renounceRole", target);
        }

        _revokeRole(accountId, role, target);
    }

    function _revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) internal {
        AccountRBAC storage accountData = _accountModuleStore().accountsRBAC[accountId];

        accountData.permissions[target].remove(role);

        if (accountData.permissions[target].length() == 0) {
            accountData.permissionAddresses.remove(target);
        }

        emit RoleRevoked(accountId, role, target, msg.sender);
    }

    modifier onlyFromTokenProxy() {
        if (msg.sender != getAccountAddress()) {
            revert OnlyTokenProxyAllowed(msg.sender);
        }

        _;
    }
}
