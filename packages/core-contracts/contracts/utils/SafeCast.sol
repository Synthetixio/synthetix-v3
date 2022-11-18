//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title TODO Utility that avoids silent overflow errors.
 *
 * Example silent overflow errors in Solidity:
 * 1) If uint256 A = type(uint128).max + 1, down casting A to uint128 returns zero.
 * 2) If int256 A = -1, casting A to uint256 returns type(uint256).max.
 */
library SafeCast {
    error CastError(bytes32 fromType, bytes32 toType);

    // Note: Overloading doesn't seem to work for similar types, i.e. int256 and int128, uint256 and uint128, etc, so explicitly naming the functions differently here.

    function uint256toUint128(uint256 x) internal pure returns (uint128) {
        if (x > type(uint128).max) {
            revert("Unable to cast uint256 to uint128");
        }

        return uint128(x);
    }

    function int256toUint256(int256 x) internal pure returns (uint256) {
        if (x < 0) {
            revert("Unable to cast int256 to uint256");
        }

        return uint256(x);
    }

    function uint128toInt128(uint128 x) internal pure returns (int128) {
        if (x > uint128(type(int128).max)) {
            revert("Unable to cast uint128 to int128");
        }

        return int128(x);
    }

    function uint128toInt256(uint128 x) internal pure returns (int256) {
        // Note: No checks are necessary here since the domain of int256 includes the domain of uint128.

        return int256(SafeCast.uint128toInt128(x));
    }

    function int256toInt128(int256 x) internal pure returns (int128) {
        if (x > int256(type(int128).max)) {
            revert("Unable to cast int256 to int128");
        }

        return int128(x);
    }

    function int128toInt256(int128 x) internal pure returns (int256) {
        // Note: No checks are necessary here since the domain of int256 includes the domain of int128.

        return int256(x);
    }

    function uint128toUint256(uint128 x) internal pure returns (uint256) {
        // Note: No checks are necessary here since the domain of uint256 includes the domain of uint128.

        return uint256(x);
    }

    function uint256toInt256(uint256 x) internal pure returns (int256) {
        if (x > uint256(type(int256).max)) {
            revert("Unable to cast uint256 to int256");
        }

        return int256(x);
    }
}
