//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

library AddressRegistry {
    struct Data {
        ISynthetixSystem synthetix;
        address sUsd;
        address oracleManager;
    }
}
