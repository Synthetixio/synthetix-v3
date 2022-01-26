//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AnotherModule {
    uint private constant _SIXTY_FOUR = 64;

    function getAnotherValue() public pure returns (uint) {
        return _SIXTY_FOUR;
    }
}
