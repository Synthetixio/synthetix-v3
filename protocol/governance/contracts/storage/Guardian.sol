//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

library Guardian {
    bytes32 private constant _STORAGE_SLOT =
        keccak256(abi.encode("io.synthetix.governance.Guardian"));

    uint64 public constant ACCEPT_OWNERSHIP_DELAY = 7 days;

    struct Data {
        address guardian;
        address nominatedGuardian;
        uint64 ownershipRequestedAt;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _STORAGE_SLOT;
        assembly {
            store.slot := s
        }
    }

    function onlyGuardian() internal view {
        if (msg.sender != getGuardian()) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function getGuardian() internal view returns (address) {
        return Guardian.load().guardian;
    }
}
