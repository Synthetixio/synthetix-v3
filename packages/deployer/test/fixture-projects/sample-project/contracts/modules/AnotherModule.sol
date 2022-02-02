//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IAnotherModule.sol";

contract AnotherModule is IAnotherModule {
    uint private constant _SIXTY_FOUR = 64;

    function getAnotherValue() public pure override returns (uint) {
        return _SIXTY_FOUR;
    }
}
