//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../modules/UpgradeModule.sol";

contract UpgradeModuleMock is UpgradeModule {
    function mockFirstOwner(address newOwner) public {
        _ownableStore().owner = newOwner;
    }
}
