//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Wrapper.sol";
import "./Price.sol";
import "./Fee.sol";

library SynthConfig {
    struct Data {
        address owner;
        uint128 marketId;
        Wrapper.Data wrapperData;
        Price.Data priceData;
        Fee.Data feeData;
    }
}
