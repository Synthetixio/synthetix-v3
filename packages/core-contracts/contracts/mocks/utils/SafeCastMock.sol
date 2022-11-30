//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/SafeCast/SafeCastU256.sol";
import "../../utils/SafeCast/SafeCastU128.sol";
import "../../utils/SafeCast/SafeCastI256.sol";
import "../../utils/SafeCast/SafeCastI128.sol";

// note: all the below functions are not pure because solidity
// has a bug or something where it doesn't return the revert reason
// in tests.
contract SafeCastMock {
    function uint256toUint128(uint256 x) public returns (uint128) {
        return SafeCastU256.to128(x);
    }

    function int256toUint256(int256 x) public returns (uint256) {
        return SafeCastI256.toUint(x);
    }

    function uint128toInt128(uint128 x) public returns (int128) {
        return SafeCastU128.toInt(x);
    }

    function uint128toInt256(uint128 x) public returns (int256) {
        return SafeCastU128.toInt(x);
    }

    function int256toInt128(int256 x) public returns (int128) {
        return SafeCastI256.to128(x);
    }

    function int128toInt256(int128 x) public returns (int256) {
        return x;
    }

    function int128toUint128(int128 x) public view returns (uint128) {
        return SafeCastI128.toUint(x);
    }

    function uint128toUint256(uint128 x) public view returns (uint256) {
        return x;
    }

    function uint256toInt256(uint256 x) public returns (int256) {
        return SafeCastU256.toInt(x);
    }
}
