//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library MathUtil {
    function abs(int x) private pure returns (int) {
        return x >= 0 ? x : -x;
    }
}
