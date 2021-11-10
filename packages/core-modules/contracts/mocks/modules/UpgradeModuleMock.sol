//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../modules/CoreUpgradeModule.sol";

contract UpgradeModuleMock is CoreUpgradeModule {
    function mockFirstOwner(address newOwner) public {
        _ownableStore().owner = newOwner;
    }
}
