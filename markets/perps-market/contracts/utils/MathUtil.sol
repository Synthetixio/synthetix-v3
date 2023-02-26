//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library MathUtil {
    function abs(int x) private pure returns (int) {
        return x >= 0 ? x : -x;
    }

    function max(int x, int y) internal pure returns (int) {
        return x < y ? y : x;
    }

    function min(int x, int y) internal pure returns (int) {
        return x < y ? x : y;
    }

    function sameSide(int a, int b) internal pure returns (bool) {
        return (a == 0) || (b == 0) || (a > 0) == (b > 0);
    }

    function signedAbs(int x) internal pure returns (int) {
        return x < 0 ? -x : x;
    }
}
