//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

library MathUtil {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    function abs(int x) internal pure returns (uint) {
        return x >= 0 ? x.toUint() : (-x).toUint();
    }

    function max(int x, int y) internal pure returns (int) {
        return x < y ? y : x;
    }

    function max(uint x, uint y) internal pure returns (uint) {
        return x < y ? y : x;
    }

    function min(int x, int y) internal pure returns (int) {
        return x < y ? x : y;
    }

    function min(uint x, uint y) internal pure returns (uint) {
        return x < y ? x : y;
    }

    function sameSide(int a, int b) internal pure returns (bool) {
        return (a == 0) || (b == 0) || (a > 0) == (b > 0);
    }
}
