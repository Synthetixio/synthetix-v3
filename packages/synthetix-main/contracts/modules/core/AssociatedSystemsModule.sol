//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../../interfaces/IAssociatedSystemsModule.sol";
import "../../storage/AssociatedSystemsStorage.sol";

import "@synthetixio/core-contracts/contracts/interfaces/IUUPSImplementation.sol";
import "@synthetixio/core-modules/contracts/interfaces/IOwnerModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

contract AssociatedSystemsModule is IAssociatedSystemsModule, OwnableMixin, AssociatedSystemsStorage {
    string public constant KIND_ERC20 = "erc20";
    string public constant KIND_ERC721 = "erc721";
    string public constant KIND_OTHER = "other";
    string public constant KIND_UNMANAGED = "unmanaged";

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

    /**
     * sets a token implementation without the corresponding upgrade functionality
     * useful for adaptation of ex. old SNX token. The connected system does not need to be
     * 
     * *NOTE:* the contract you are connecting should still be owned by your dao. The
     * system is not expected to be able to do upgrades for you.
     */
    function registerUnmanagedSystem(bytes32 id, address endpoint) external override onlyOwner {
        _associatedSystemsStore().satellites[id] = AssociatedSystem(endpoint, endpoint, KIND_UNMANAGED);
    }

    event AssociatedSystemCreated(bytes32 indexed id, address proxy, address impl);
    event AssociatedSystemUpgraded(bytes32 indexed id, address proxy, address impl);
}
