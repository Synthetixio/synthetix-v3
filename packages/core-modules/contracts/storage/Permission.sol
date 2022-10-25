//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library Permission {
    struct Data {
        bool enabled;
        SetUtil.AddressSet permissionedAddresses;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("FeatureFlag.Permission"));
        assembly {
            store.slot := s
        }
    }
}
