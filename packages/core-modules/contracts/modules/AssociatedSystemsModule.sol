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
    function initOrUpgradeToken(bytes32 id, string memory name, string memory symbol, uint8 decimals, address impl) external override onlyOwner {
        AssociatedSystemsStore storage store = _associatedSystemsStore();

        if (store.satellites[id].proxy != address(0)) {
            _requireKind(id, _KIND_ERC20);

            store.satellites[id].impl = impl;

            // tell the associated proxy to upgrade to the new implementation
            IUUPSImplementation(store.satellites[id].proxy).upgradeTo(impl);
            emit AssociatedSystemUpgraded(id, store.satellites[id].proxy, store.satellites[id].impl);
        }
        else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxy(impl));

            IOwnerModule(proxy).initializeOwnerModule(address(this));
            ITokenModule(proxy).initialize(name, symbol, decimals);

            store.satellites[id] = AssociatedSystem(proxy, impl, _KIND_ERC20);

            emit AssociatedSystemUpgraded(id, proxy, impl);
        }
    }

    function initOrUpgradeNft(bytes32 id, string memory name, string memory symbol, string memory uri, address impl) external override onlyOwner {
        AssociatedSystemsStore storage store = _associatedSystemsStore();

        if (store.satellites[id].proxy != address(0)) {
            _requireKind(id, _KIND_ERC721);

            store.satellites[id].impl = impl;

            // tell the associated proxy to upgrade to the new implementation
            IUUPSImplementation(store.satellites[id].proxy).upgradeTo(impl);
            emit AssociatedSystemUpgraded(id, store.satellites[id].proxy, store.satellites[id].impl);
        }
        else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxy(impl));

            IOwnerModule(proxy).initializeOwnerModule(address(this));
            INftModule(proxy).initialize(name, symbol, uri);

            store.satellites[id] = AssociatedSystem(proxy, impl, _KIND_ERC721);

            emit AssociatedSystemUpgraded(id, proxy, impl);
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

        _associatedSystemsStore().satellites[id] = AssociatedSystem(endpoint, endpoint, _KIND_UNMANAGED);
    }

    function getAssociatedSystem(bytes32 id) external view override returns (address proxy, bytes32 kind) {
        proxy = _associatedSystemsStore().satellites[id].proxy;
        kind = _associatedSystemsStore().satellites[id].kind;
    }

    event AssociatedSystemCreated(bytes32 indexed id, address proxy, address impl);
    event AssociatedSystemUpgraded(bytes32 indexed id, address proxy, address impl);
}
