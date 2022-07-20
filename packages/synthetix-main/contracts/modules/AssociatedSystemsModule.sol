//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../interfaces/IAssociatedSystemsModule.sol";
import "../storage/AssociatedSystemsStorage.sol";

import "@synthetixio/core-contracts/contracts/interfaces/IUUPSImplementation.sol";
import "@synthetixio/core-modules/contracts/interfaces/IOwnerModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

contract AssociatedSystemsModule is IAssociatedSystemsModule, OwnableMixin, AssociatedSystemsStorage, SatelliteFactory {

    function initOrUpgradeToken(bytes32 id, string memory name, string memory symbol, uint8 decimals, address impl) external override onlyOwner {
        AssociatedSystemsStore storage store = _associatedSystemsStore();

        if (store.satellites[id].proxy != address(0)) {
            // tell the associated proxy to upgrade to the new implementation
            IUUPSImplementation(store.satellites[id].proxy).upgradeTo(impl);
            emit AssociatedSystemUpgraded(id, store.satellites[id].proxy, store.satellites[id].impl);
        }
        else {
            // create a new proxy and own it
            address proxy = address(new UUPSProxy(impl));

            IOwnerModule(proxy).initializeOwnerModule(address(this));
            ITokenModule(proxy).initialize(name, symbol, decimals);

            store.satellites[id] = AssociatedSystem(proxy, impl, KIND_ERC20);

            emit AssociatedSystemUpgraded(id, proxy, impl);
        }
    }

    function add(bytes32 id, address endpoint) external override onlyOwner {

    }

    event AssociatedSystemCreated(bytes32 indexed id, address proxy, address impl);
    event AssociatedSystemUpgraded(bytes32 indexed id, address proxy, address impl);
}
