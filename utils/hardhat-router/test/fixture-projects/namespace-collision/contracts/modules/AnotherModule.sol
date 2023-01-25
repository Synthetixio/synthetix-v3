//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAnotherModule.sol";

contract AnotherModule is IAnotherModule {
    function getValue() public pure override returns (uint) {
        return 64;
    }
}
