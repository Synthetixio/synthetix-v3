//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../errors/AccessError.sol";

library OwnableStorage {
    struct Data {
        bool initialized;
        address owner;
        address nominatedOwner;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Ownable"));
        assembly {
            store.slot := s
        }
    }

    function onlyOwner() internal view {
        if (msg.sender != getOwner()) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function getOwner() internal view returns (address) {
        return OwnableStorage.load().owner;
    }
}
