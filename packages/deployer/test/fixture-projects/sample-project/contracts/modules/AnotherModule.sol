//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IAnotherModule.sol";

contract AnotherModule is IAnotherModule {
    function getAnotherValue() public pure override returns (uint) {
        return 64;
    }
}
