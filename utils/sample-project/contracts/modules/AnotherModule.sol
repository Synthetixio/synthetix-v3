//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAnotherModule.sol";

contract AnotherModule is IAnotherModule {
    uint private constant _SIXTY_FOUR = 64;
    uint private immutable _leet = 1337;

    function getAnotherValue() public pure override returns (uint) {
        return _SIXTY_FOUR;
    }

    function getAnotherImmutableValue() public pure override returns (uint) {
        return _leet;
    }
}
