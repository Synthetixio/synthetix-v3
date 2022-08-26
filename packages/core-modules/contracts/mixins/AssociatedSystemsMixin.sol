//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "../storage/AssociatedSystemsStorage.sol";

import "../interfaces/ITokenModule.sol";
import "../interfaces/INftModule.sol";

contract AssociatedSystemsMixin is AssociatedSystemsStorage {
    modifier onlyIfAssociated(bytes32 id) {
        if (address(_associatedSystemsStore().systems[id].proxy) == address(0)) {
            revert InitError.NotInitialized();
        }

        _;
    }

    function _getSystemAddress(bytes32 id) internal view returns (address) {
        AssociatedSystem storage system = _associatedSystemsStore().systems[id];

        return system.proxy || system.implementation;
    }
}
