//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library CouncilMembers {
    bytes32 private constant _STORAGE_SLOT =
        keccak256(abi.encode("io.synthetix.governance.CouncilMembers"));

    struct Data {
        // The address of the council NFT
        address councilToken;
        // Council member addresses
        SetUtil.AddressSet councilMembers;
        // Council token id's by council member address
        mapping(address => uint) councilTokenIds;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _STORAGE_SLOT;
        assembly {
            store.slot := s
        }
    }
}
