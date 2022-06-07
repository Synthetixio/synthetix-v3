//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/MathUtil.sol";

contract MathUtilMock {
    function sqrt(uint x) public pure returns (uint z) {
        return MathUtil.sqrt(x);
    }

    function mulDivDown(
        uint256 x,
        uint256 y,
        uint256 denominator
    ) public pure returns (uint256) {
        return MathUtil.mulDivDown(x, y, denominator);
    }

    function mulDivUp(
        uint256 x,
        uint256 y,
        uint256 denominator
    ) public pure returns (uint256) {
        return MathUtil.mulDivUp(x, y, denominator);
    }
}
