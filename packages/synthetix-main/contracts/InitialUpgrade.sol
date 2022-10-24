//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";

// solhint-disable-next-line no-empty-blocks
contract InitialUpgrade is UUPSImplementation {
    function upgradeTo(address newImplementation) public override {
        ProxyStore storage store = _proxyStore();
        if (newImplementation == store.implementation) return;
        _upgradeTo(newImplementation);
    }
}
