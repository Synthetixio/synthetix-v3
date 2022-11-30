//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Utility that avoids silent overflow errors.
 *
 */
library SafeCastU128 {
    error OverflowInt128ToUint128();

    function toInt(uint128 x) internal pure returns (int128) {
        // -------------------------------o===============>----------------
        // ----------------<==============o==============>x----------------
        if (x > uint128(type(int128).max)) {
            revert OverflowInt128ToUint128();
        }

        return int128(x);
    }
}
