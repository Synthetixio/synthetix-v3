//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxyWithOwner.sol";
import "../interfaces/IAssociatedSystemsModule.sol";

import "@synthetixio/core-contracts/contracts/interfaces/IUUPSImplementation.sol";
import "../interfaces/IOwnerModule.sol";
import "../interfaces/ITokenModule.sol";
import "../interfaces/INftModule.sol";

import "../storage/AssociatedSystem.sol";

/**
 * @title Module for connecting a system with other associated systems.
 * @dev See IAssociatedSystemsModule.
 */
contract AssociatedSystemsModule is IAssociatedSystemsModule {
    using AssociatedSystem for AssociatedSystem.Data;

    modifier onlyIfAssociated(bytes32 id) {
        if (address(AssociatedSystem.load(id).proxy) == address(0)) {
            revert MissingAssociatedSystem(id);
        }

        _;
    }

    /**
     * @inheritdoc IAssociatedSystemsModule
     */
    function initOrUpgradeToken(
        bytes32 id,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address impl
    ) external override {
        OwnableStorage.onlyOwner();
        _initOrUpgradeToken(id, name, symbol, decimals, impl);
    }

    /**
     * @inheritdoc IAssociatedSystemsModule
     */
    function initOrUpgradeNft(
        bytes32 id,
        string memory name,
        string memory symbol,
        string memory uri,
        address impl
    ) external override {
        OwnableStorage.onlyOwner();
        _initOrUpgradeNft(id, name, symbol, uri, impl);
    }

    /**
     * @inheritdoc IAssociatedSystemsModule
     */
    function registerUnmanagedSystem(bytes32 id, address endpoint) external override {
        OwnableStorage.onlyOwner();
        // empty string require kind will make sure the system is either unregistered or already unmanaged
        AssociatedSystem.load(id).expectKind("");

        _setAssociatedSystem(id, AssociatedSystem.KIND_UNMANAGED, endpoint, endpoint);
    }

    /**
     * @inheritdoc IAssociatedSystemsModule
     */
    function getAssociatedSystem(
        bytes32 id
    ) external view override returns (address addr, bytes32 kind) {
        addr = AssociatedSystem.load(id).proxy;
        kind = AssociatedSystem.load(id).kind;
    }

    function _setAssociatedSystem(bytes32 id, bytes32 kind, address proxy, address impl) internal {
        AssociatedSystem.load(id).set(proxy, impl, kind);
        emit AssociatedSystemSet(kind, id, proxy, impl);
    }

    function _upgradeToken(
        bytes32 id,
        address impl
    ) internal returns (AssociatedSystem.Data storage store) {
        store = AssociatedSystem.load(id);
        store.expectKind(AssociatedSystem.KIND_ERC20);

        store.impl = impl;

        address proxy = store.proxy;

        // tell the associated proxy to upgrade to the new implementation
        IUUPSImplementation(proxy).upgradeTo(impl);

        emit AssociatedSystemSet(AssociatedSystem.KIND_ERC20, id, proxy, impl);
    }

    function _upgradeNft(
        bytes32 id,
        address impl
    ) internal returns (AssociatedSystem.Data storage store) {
        store = AssociatedSystem.load(id);
        store.expectKind(AssociatedSystem.KIND_ERC721);

        store.impl = impl;

        address proxy = store.proxy;

        // tell the associated proxy to upgrade to the new implementation
        IUUPSImplementation(proxy).upgradeTo(impl);

        emit AssociatedSystemSet(AssociatedSystem.KIND_ERC721, id, proxy, impl);
    }

    function _initOrUpgradeToken(
        bytes32 id,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address impl
    ) internal {
        AssociatedSystem.Data storage store = AssociatedSystem.load(id);

        if (store.proxy != address(0)) {
            if (store.impl != impl) {
                _upgradeToken(id, impl);
            }
            ITokenModule(store.proxy).initialize(name, symbol, decimals);
        } else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxyWithOwner(impl, address(this)));

            ITokenModule(proxy).initialize(name, symbol, decimals);

            _setAssociatedSystem(id, AssociatedSystem.KIND_ERC20, proxy, impl);
        }
    }

    function _initOrUpgradeNft(
        bytes32 id,
        string memory name,
        string memory symbol,
        string memory uri,
        address impl
    ) internal {
        OwnableStorage.onlyOwner();
        AssociatedSystem.Data storage store = AssociatedSystem.load(id);

        if (store.proxy != address(0)) {
            _upgradeNft(id, impl);
        } else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxyWithOwner(impl, address(this)));

            INftModule(proxy).initialize(name, symbol, uri);

            _setAssociatedSystem(id, AssociatedSystem.KIND_ERC721, proxy, impl);
        }
    }
}
