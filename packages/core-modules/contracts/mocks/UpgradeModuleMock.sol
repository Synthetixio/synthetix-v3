//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../modules/UpgradeModule.sol";

contract UpgradeModuleMock is UpgradeModule {
    // solhint-disable-next-line private-vars-leading-underscore
    function __setOwner(address newOwner) public {
        _ownerStorage().owner = newOwner;
    }

    // solhint-disable-next-line private-vars-leading-underscore
    function __getOwner() public view returns (address) {
        return _ownerStorage().owner;
    }

    // solhint-disable-next-line private-vars-leading-underscore
    function __setSimulatingUpgrade(bool simulatingUpgrade) public {
        _setSimulatingUpgrade(simulatingUpgrade);
    }
}
