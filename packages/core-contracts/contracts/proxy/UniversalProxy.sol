//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";

contract UniversalProxy is ContractUtil {
    event Upgraded(address implementation);

    function upgradeTo(address newImplementation) public {
        require(newImplementation != address(0), "Implementation is zero address");
        require(_isContract(newImplementation), "Implementation not a contract");

        emit Upgraded(newImplementation);
    }
}
