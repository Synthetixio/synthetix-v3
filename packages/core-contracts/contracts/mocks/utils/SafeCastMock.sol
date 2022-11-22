//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/SafeCast.sol";

contract SafeCastMock {
    // Note: These functions could be pure, but there's a bug on the Solidity compiler where error reasons are not returned from public pure functions.

    function uint256toUint128(uint256 x) public view returns (uint128) {
        return SafeCast.uint256toUint128(x);
    }

    function int256toUint256(int256 x) public view returns (uint256) {
        return SafeCast.int256toUint256(x);
    }

    function uint128toInt128(uint128 x) public view returns (int128) {
        return SafeCast.uint128toInt128(x);
    }

    function toInt256(uint128 x) public view returns (int256) {
        return SafeCast.toInt256(x);
    }

    function int256toInt128(int256 x) public view returns (int128) {
        return SafeCast.int256toInt128(x);
    }

    function toInt256(int128 x) public view returns (int256) {
        return SafeCast.toInt256(x);
    }

    function toUint256(uint128 x) public view returns (uint256) {
        return SafeCast.toUint256(x);
    }

    function uint256toInt256(uint256 x) public view returns (int256) {
        return SafeCast.uint256toInt256(x);
    }
}
