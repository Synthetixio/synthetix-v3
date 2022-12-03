//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Utility that avoids silent overflow errors.
 *
 */
library SafeCastI256 {
    error OverflowInt256ToUint256();
    error OverflowInt256ToInt128();

    function to128(int256 x) internal pure returns (int128) {
        // ----<==========================o===========================>----
        // ----xxxxxxxxxxxx<==============o==============>xxxxxxxxxxxxx----
        if (x < int256(type(int128).min) || x > int256(type(int128).max)) {
            revert OverflowInt256ToInt128();
        }

        return int128(x);
    }

    function toUint(int256 x) internal pure returns (uint256) {
        // ----<==========================o===========================>----
        // ----xxxxxxxxxxxxxxxxxxxxxxxxxxxo===============================>
        if (x < 0) {
            revert OverflowInt256ToUint256();
        }

        return uint256(x);
    }
}
