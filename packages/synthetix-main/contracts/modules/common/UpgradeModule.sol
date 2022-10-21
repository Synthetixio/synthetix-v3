//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {UpgradeModule as BaseUpgradeModule} from "@synthetixio/core-modules/contracts/modules/UpgradeModule.sol";

contract UpgradeModule is BaseUpgradeModule {
    function safeUpgradeTo(address newImplementation) public onlyOwner {
        ProxyStore storage store = _proxyStore();
        if (newImplementation == store.implementation) return;
        _upgradeTo(newImplementation);
    }
}
