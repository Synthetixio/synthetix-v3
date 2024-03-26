//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/// @dev Math utilities mostly copied from PerpsV2 (https://github.com/Synthetixio/synthetix/blob/develop/contracts/PerpsV2MarketBase.sol)
library MathUtil {
    // @custom:ref https://github.com/Vectorized/solady/blob/main/src/utils/FixedPointMathLib.sol
    // @custom:ref https://github.com/Kwenta/smart-margin-v3/blob/omniscia-audit-response/src/libraries/MathLib.sol
    function abs(int256 x) internal pure returns (uint256 z) {
        assembly {
            /// shr(255, x):
            /// shifts the number x to the right by 255 bits:
            /// IF the number is negative, the leftmost bit (bit 255) will be 1
            /// IF the number is positive,the leftmost bit (bit 255) will be 0

            /// sub(0, shr(255, x)):
            /// creates a mask of all 1s if x is negative
            /// creates a mask of all 0s if x is positive
            let mask := sub(0, shr(255, x))

            /// If x is negative, this effectively negates the number
            /// if x is positive, it leaves the number unchanged, thereby computing the absolute value
            z := xor(mask, add(mask, x))
        }
    }

    function max(int256 x, int256 y) internal pure returns (int256) {
        return x < y ? y : x;
    }

    function max(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? y : x;
    }

    function min(int256 x, int256 y) internal pure returns (int256) {
        return x < y ? x : y;
    }

    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }

    function sameSide(int256 a, int256 b) internal pure returns (bool) {
        return (a == 0) || (b == 0) || (a > 0) == (b > 0);
    }
}
