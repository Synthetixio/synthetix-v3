//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../interfaces/IAssociatedSystemsModule.sol";
import "../mixins/AssociatedSystemsMixin.sol";

import "@synthetixio/core-contracts/contracts/interfaces/IUUPSImplementation.sol";
import "../interfaces/IOwnerModule.sol";
import "../interfaces/ITokenModule.sol";
import "../interfaces/INftModule.sol";

contract AssociatedSystemsModule is IAssociatedSystemsModule, OwnableMixin, AssociatedSystemsMixin {
    function initOrUpgradeToken(
        bytes32 id,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address impl
    ) external override onlyOwner {
        AssociatedSystemsStore storage store = _associatedSystemsStore();

        if (store.systems[id].proxy != address(0)) {
            _requireKind(id, _KIND_ERC20);

            store.systems[id].impl = impl;

            address proxy = store.systems[id].proxy;

            // tell the associated proxy to upgrade to the new implementation
            IUUPSImplementation(proxy).upgradeTo(impl);

            _setAssociatedSystem(id, _KIND_ERC20, proxy, impl);
        } else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxy(impl));

            IOwnerModule(proxy).initializeOwnerModule(address(this));
            ITokenModule(proxy).initialize(name, symbol, decimals);

            _setAssociatedSystem(id, _KIND_ERC20, proxy, impl);
        }
    }

    function initOrUpgradeNft(
        bytes32 id,
        string memory name,
        string memory symbol,
        string memory uri,
        address impl
    ) external override onlyOwner {
        AssociatedSystemsStore storage store = _associatedSystemsStore();

        if (store.systems[id].proxy != address(0)) {
            _requireKind(id, _KIND_ERC721);

            address proxy = store.systems[id].proxy;

            // tell the associated proxy to upgrade to the new implementation
            IUUPSImplementation(proxy).upgradeTo(impl);

            _setAssociatedSystem(id, _KIND_ERC721, proxy, impl);
        } else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxy(impl));

            IOwnerModule(proxy).initializeOwnerModule(address(this));
            INftModule(proxy).initialize(name, symbol, uri);

            _setAssociatedSystem(id, _KIND_ERC721, proxy, impl);
        }
    }

    /**
     * sets a token implementation without the corresponding upgrade functionality
     * useful for adaptation of ex. old SNX token. The connected system does not need to be
     *
     * *NOTE:* the contract you are connecting should still be owned by your dao. The
     * system is not expected to be able to do upgrades for you.
     */
    function registerUnmanagedSystem(bytes32 id, address endpoint) external override onlyOwner {
        // empty string require kind will make sure the system is either unregistered or already unmanaged
        _requireKind(id, "");

        _setAssociatedSystem(id, _KIND_UNMANAGED, endpoint, endpoint);
    }

    function _setAssociatedSystem(
        bytes32 id,
        bytes32 kind,
        address proxy,
        address impl
    ) internal {
        _associatedSystemsStore().systems[id] = AssociatedSystem(proxy, impl, kind);
        emit AssociatedSystemSet(kind, id, proxy, impl);
    }

    function getAssociatedSystem(bytes32 id) external view override returns (address proxy, bytes32 kind) {
        proxy = _associatedSystemsStore().systems[id].proxy;
        kind = _associatedSystemsStore().systems[id].kind;
    }

    event AssociatedSystemSet(bytes32 indexed kind, bytes32 indexed id, address proxy, address impl);
}
