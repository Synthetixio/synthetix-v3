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

    function mulDecimal(uint256 x, uint256 y) public pure returns (uint256) {
        return MathUtil.mulDecimal(x, y);
    }

    function divDecimal(uint256 x, uint256 y) public pure returns (uint256) {
        return MathUtil.divDecimal(x, y);
    }

    function mulDivDown(
        int256 x,
        int256 y,
        int256 denominator
    ) public pure returns (int256) {
        return MathUtil.mulDivDown(x, y, denominator);
    }

    function mulDecimal(int256 x, int256 y) public pure returns (int256) {
        return MathUtil.mulDecimal(x, y);
    }

    function divDecimal(int256 x, int256 y) public pure returns (int256) {
        return MathUtil.divDecimal(x, y);
    }
}
