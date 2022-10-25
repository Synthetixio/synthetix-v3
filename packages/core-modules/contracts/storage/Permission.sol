//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library Permission {
    struct Data {
        bool enabled;
        SetUtil.AddressSet permissionedAddresses;
    }
}
