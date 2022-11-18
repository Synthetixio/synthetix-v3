//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/SafeCast.sol";

contract SafeCastMock {
    // Note: These functions could be pure, but there's a bug on the Solidity compiler where error reasons are not returned from public pure functions.

    function toUint128(uint256 x) public view returns (uint128) {
        return SafeCast.toUint128(x);
    }

    function toUint256(int256 x) public view returns (uint256) {
        return SafeCast.toUint256(x);
    }

    function toInt128(uint128 x) public view returns (int128) {
        return SafeCast.toInt128(x);
    }

    function toInt256(uint128 x) public view returns (int256) {
        return SafeCast.toInt256(x);
    }

    function toInt128(int256 x) public view returns (int128) {
        return SafeCast.toInt128(x);
    }
}
