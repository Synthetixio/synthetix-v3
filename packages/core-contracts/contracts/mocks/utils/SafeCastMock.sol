//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/SafeCast.sol";

contract SafeCastMock {
    function uint256toUint128(uint256 x) public returns (uint128) {
        return SafeCast.uint256toUint128(x);
    }

    function int256toUint256(int256 x) public returns (uint256) {
        return SafeCast.int256toUint256(x);
    }

    function uint128toInt128(uint128 x) public returns (int128) {
        return SafeCast.uint128toInt128(x);
    }

    function uint128toInt256(uint128 x) public returns (int256) {
        return SafeCast.uint128toInt256(x);
    }

    function int256toInt128(int256 x) public returns (int128) {
        return SafeCast.int256toInt128(x);
    }

    function int128toInt256(int128 x) public returns (int256) {
        return SafeCast.int128toInt256(x);
    }

    function int128toUint128(int128 x) public view returns (uint128) {
        return SafeCast.int128toUint128(x);
    }

    function uint128toUint256(uint128 x) public view returns (uint256) {
        return SafeCast.uint128toUint256(x);
    }

    function uint256toInt256(uint256 x) public returns (int256) {
        return SafeCast.uint256toInt256(x);
    }
}
