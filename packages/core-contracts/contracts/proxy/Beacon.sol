// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ProxyStorage.sol";
import "../common/CommonErrors.sol";
import "../utils/ContractUtil.sol";

contract Beacon is ProxyStorage, ContractUtil, CommonErrors {
    event Upgraded(address implementation);

    constructor(address firstImplementation) {
        setImplementation(firstImplementation);
    }

    function setImplementation(address newImplementation) public {
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }

        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }

        _proxyStorage().implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _proxyStorage().implementation;
    }
}
