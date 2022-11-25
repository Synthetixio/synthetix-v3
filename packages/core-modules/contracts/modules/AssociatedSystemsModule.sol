//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../interfaces/IAssociatedSystemsModule.sol";

import "@synthetixio/core-contracts/contracts/interfaces/IUUPSImplementation.sol";
import "../interfaces/IOwnerModule.sol";
import "../interfaces/ITokenModule.sol";
import "../interfaces/INftModule.sol";

import "../storage/AssociatedSystem.sol";

contract AssociatedSystemsModule is IAssociatedSystemsModule {
    using AssociatedSystem for AssociatedSystem.Data;

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

    function initOrUpgradeNft(
        bytes32 id,
        string memory name,
        string memory symbol,
        string memory uri,
        address impl
    ) external override {
        OwnableStorage.onlyOwner();
        AssociatedSystem.Data storage store = AssociatedSystem.load(id);

        if (store.proxy != address(0)) {
            store.expectKind(AssociatedSystem.KIND_ERC721);

            address proxy = store.proxy;

            // tell the associated proxy to upgrade to the new implementation
            IUUPSImplementation(proxy).upgradeTo(impl);

            _setAssociatedSystem(id, AssociatedSystem.KIND_ERC721, proxy, impl);
        } else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxy(impl));

            IOwnerModule(proxy).initializeOwnerModule(address(this));
            INftModule(proxy).initialize(name, symbol, uri);

            _setAssociatedSystem(id, AssociatedSystem.KIND_ERC721, proxy, impl);
        }
    }

    /**
     * sets a token implementation without the corresponding upgrade functionality
     * useful for adaptation of ex. old SNX token. The connected system does not need to be
     *
     * *NOTE:* the contract you are connecting should still be owned by your dao. The
     * system is not expected to be able to do upgrades for you.
     */
    function registerUnmanagedSystem(bytes32 id, address endpoint) external override {
        OwnableStorage.onlyOwner();
        // empty string require kind will make sure the system is either unregistered or already unmanaged
        AssociatedSystem.load(id).expectKind("");

        _setAssociatedSystem(id, AssociatedSystem.KIND_UNMANAGED, endpoint, endpoint);
    }

    function _setAssociatedSystem(
        bytes32 id,
        bytes32 kind,
        address proxy,
        address impl
    ) internal {
        AssociatedSystem.load(id).set(proxy, impl, kind);
        emit AssociatedSystemSet(kind, id, proxy, impl);
    }

    function getAssociatedSystem(bytes32 id) external view override returns (address proxy, bytes32 kind) {
        proxy = AssociatedSystem.load(id).proxy;
        kind = AssociatedSystem.load(id).kind;
    }

    modifier onlyIfAssociated(bytes32 id) {
        if (address(AssociatedSystem.load(id).proxy) == address(0)) {
            revert InitError.NotInitialized();
        }

        _;
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
            _upgradeToken(id, impl);
        } else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxy(impl));

            IOwnerModule(proxy).initializeOwnerModule(address(this));
            ITokenModule(proxy).initialize(name, symbol, decimals);

            _setAssociatedSystem(id, AssociatedSystem.KIND_ERC20, proxy, impl);
        }
    }

    function _upgradeToken(bytes32 id, address impl) internal {
        AssociatedSystem.Data storage store = AssociatedSystem.load(id);
        store.expectKind(AssociatedSystem.KIND_ERC20);

        store.impl = impl;

        address proxy = store.proxy;

        // tell the associated proxy to upgrade to the new implementation
        IUUPSImplementation(proxy).upgradeTo(impl);

        _setAssociatedSystem(id, AssociatedSystem.KIND_ERC20, proxy, impl);
    }

    event AssociatedSystemSet(bytes32 indexed kind, bytes32 indexed id, address proxy, address impl);
}
