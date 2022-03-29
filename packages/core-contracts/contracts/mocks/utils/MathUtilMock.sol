//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/MathUtil.sol";

contract MathUtilMock {
    function sqrt(uint x) public pure returns (uint z) {
        return MathUtil.sqrt(x);
    }
}
