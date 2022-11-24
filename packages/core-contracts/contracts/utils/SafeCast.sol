//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Utility that avoids silent overflow errors.
 *
 * Example silent overflow errors in Solidity:
 * 1) If uint256 A = type(uint128).max + 1, down casting A to uint128 returns zero.
 * 2) If int256 A = -1, casting A to uint256 returns type(uint256).max.
 *
 * Visual helper:
 * uint256 [0, 2^256 - 1]          -------------------------------o===============================>
 * int256  [-2^255 - 1, 2^255 - 1] ----<==========================o===========================>----
 * uint128 [0, 2^128 - 1]          -------------------------------o===============>----------------
 * int128 [-2^127 - 1, 2^127 - 1]  ----------------<==============o==============>-----------------
 */
library SafeCast {
    error OverflowUint256ToUint128();
    error OverflowInt256ToUint256();
    error OverflowUint128ToInt128();
    error OverflowInt256ToInt128();
    error OverflowUint256ToInt256();

    // Note: Overloading doesn't seem to work for similar types, i.e. int256 and int128, uint256 and uint128, etc, so explicitly naming the functions differently here.

    function uint256toUint128(uint256 x) internal pure returns (uint128) {
        // -------------------------------o===============================>
        // -------------------------------o===============>xxxxxxxxxxxxxxxx
        if (x > type(uint128).max) {
            revert OverflowUint256ToUint128();
        }

        return uint128(x);
    }

    function int256toUint256(int256 x) internal pure returns (uint256) {
        // ----<==========================o===========================>----
        // ----xxxxxxxxxxxxxxxxxxxxxxxxxxxo===============================>
        if (x < 0) {
            revert OverflowInt256ToUint256();
        }

        return uint256(x);
    }

    function uint128toInt128(uint128 x) internal pure returns (int128) {
        // -------------------------------o===============>----------------
        // ----------------<==============o==============>x----------------
        if (x > uint128(type(int128).max)) {
            revert OverflowUint128ToInt128();
        }

        return int128(x);
    }

    function uint128toInt256(uint128 x) internal pure returns (int256) {
        // No checks are necessary here since the domain of int256 includes the domain of uint128.
        // -------------------------------o===============>----------------
        // ----<==========================o===========================>----

        return int256(SafeCast.uint128toInt128(x));
    }

    function int256toInt128(int256 x) internal pure returns (int128) {
        // ----<==========================o===========================>----
        // ----xxxxxxxxxxxx<==============o==============>xxxxxxxxxxxxx----
        if (x < int256(type(int128).min) || x > int256(type(int128).max)) {
            revert OverflowInt256ToInt128();
        }

        return int128(x);
    }

    function int128toInt256(int128 x) internal pure returns (int256) {
        // No checks are necessary here since the domain of int256 includes the domain of int128.
        // ----------------<==============o==============>-----------------
        // ----<==========================o===========================>----

        return int256(x);
    }

    function int128toUint128(int128 x) internal pure returns (uint128) {
        // ----------------<==============o==============>-----------------
        // ----------------xxxxxxxxxxxxxxxo===============>----------------
        if (x < 0) {
            revert("Failed cast int128 to uint128");
        }

        return uint128(x);
    }

    function uint128toUint256(uint128 x) internal pure returns (uint256) {
        // No checks are necessary here since the domain of uint256 includes the domain of uint128.
        // -------------------------------o===============>----------------
        // -------------------------------o===============================>

        return uint256(x);
    }

    function uint256toInt256(uint256 x) internal pure returns (int256) {
        // -------------------------------o===============================>
        // ----<==========================o===========================>xxxx
        if (x > uint256(type(int256).max)) {
            revert OverflowUint256ToInt256();
        }

        return int256(x);
    }
}
