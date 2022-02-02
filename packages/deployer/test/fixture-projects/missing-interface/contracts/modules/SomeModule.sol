//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SomeModule {
    function giveMeSomething() external pure returns (bool) {
        return _someBool();
    }

    function giveMeSomethingPublic() public pure returns (bool) {
        return _someBool();
    }

    function _someBool() internal pure returns (bool) {
        return false;
    }
}
