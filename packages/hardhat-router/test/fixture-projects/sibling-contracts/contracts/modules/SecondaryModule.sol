//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {PrimaryModule as BaseModule} from "../mixins/PrimaryModule.sol";

contract SecondaryModule is BaseModule {
    function getNumber() public pure override returns (uint) {
        return 50;
    }
}
