//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/SafeCast/SafeCastU256.sol";
import "../../utils/SafeCast/SafeCastU128.sol";
import "../../utils/SafeCast/SafeCastI256.sol";
import "../../utils/SafeCast/SafeCastI128.sol";

// Note: The functions below are not pure because of an apparent
// bug in the test pipeline (Solidity? Ethers?) where revert reasons
// are not retrieved if the functions are pure.
contract SafeCastMock {
    // solc-ignore-next-line func-mutability
    function uint256toUint128(uint256 x) external view returns (uint128) {
        return SafeCastU256.to128(x);
    }

    // solc-ignore-next-line func-mutability
    function int256toUint256(int256 x) external view returns (uint256) {
        return SafeCastI256.toUint(x);
    }

    // solc-ignore-next-line func-mutability
    function uint128toInt128(uint128 x) external view returns (int128) {
        return SafeCastU128.toInt(x);
    }

    // solc-ignore-next-line func-mutability
    function uint128toInt256(uint128 x) external view returns (int256) {
        return SafeCastU128.toInt(x);
    }

    // solc-ignore-next-line func-mutability
    function int256toInt128(int256 x) external view returns (int128) {
        return SafeCastI256.to128(x);
    }

    // solc-ignore-next-line func-mutability
    function int128toInt256(int128 x) external view returns (int256) {
        return x;
    }

    // solc-ignore-next-line func-mutability
    function int128toUint128(int128 x) external view returns (uint128) {
        return SafeCastI128.toUint(x);
    }

    // solc-ignore-next-line func-mutability
    function uint128toUint256(uint128 x) external view returns (uint256) {
        return x;
    }

    // solc-ignore-next-line func-mutability
    function uint256toInt256(uint256 x) external view returns (int256) {
        return SafeCastU256.toInt(x);
    }
}
