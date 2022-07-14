//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";

contract AssociatedSystemsStorage {

    struct AssociatedToken {
        string name;
        string symbol;
        uint8 decimals;

        address proxy;
        address impl;
    }

    struct AssociatedSystemsStore {
        mapping (string => AssociatedToken) tokens;

    }

    // solhint-disable-next-line func-name-mixedcase
    function _associatedSystemsStore() internal pure returns (AssociatedSystemsStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.associatedSystems")) - 1)
            // todo
            store.slot := 0x0
        }
    }
}
