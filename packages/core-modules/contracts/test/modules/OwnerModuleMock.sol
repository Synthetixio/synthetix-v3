//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../modules/OwnerModule.sol";

contract OwnerModuleMock is OwnerModule {
    // solhint-disable-next-line private-vars-leading-underscore
    function __setOwner(address newOwner) public {
        return _setOwner(newOwner);
    }

    // solhint-disable-next-line private-vars-leading-underscore
    function __getOwner() public view returns (address) {
        return _getOwner();
    }

    // solhint-disable-next-line private-vars-leading-underscore
    function __setNominatedOwner(address newNominatedOwner) public {
        _setNominatedOwner(newNominatedOwner);
    }

    // solhint-disable-next-line private-vars-leading-underscore
    function __getNominatedOwner() public view returns (address) {
        return _getNominatedOwner();
    }
}
