//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../interfaces/IAssociatedSystemsModule.sol";
import "../storage/AssociatedSystemsStorage.sol";

contract AssociatedSystemsModule is IAssociatedSystemsModule, OwnableMixin, AssociatedSystemsStorage, SatelliteFactory {

    function initOrUpgradeToken(string memory name, string memory symbol, uint8 decimals, address impl) external override onlyOwner {
        AssociatedSystemsStore storage store = _associatedSystemsStore();

        if (store.tokens[symbol]) {
            // tell the associated proxy to upgrade to the new implementation
            store.tokens[symbol].upgradeTo(impl);
            emit TokenUpgraded(symbol,  impl);
        }
        else {
            // create a new proxy and own it
            UUPSProxy proxy = new UUPSProxy(address(impl));
            proxy.nominateNewOwner(address(this));
            proxy.acceptOwnership();

            proxy.initialize("Synthetix Network Token", "snx", 18);
            emit TokenCreated(symbol, proxy, name, decimals, impl);
        }

        store.tokens[symbol] = AssociatedToken(name, symbol, decimals, impl);
    }

    event TokenCreated(string indexed symbol, address indexed proxy, string name, uint8 decimals, address impl);
    event TokenUpgraded(string indexed symbol, address indexed proxy, address impl);
}
