//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";

contract AssociatedSystemsStorage {

    string public constant KIND_ERC20 = "erc20";
    string public constant KIND_ERC721 = "erc721";
    string public constant KIND_OTHER = "other";

    struct AssociatedSystem {
        address proxy;
        address impl;
        string kind;
    }

    struct AssociatedSystemsStore {
        mapping (bytes32 => AssociatedSystem) satellites;
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
