//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../utils/SafeCast.sol";

// Note: The functions below are not pure because of an apparent
// bug in the test pipeline (Solidity? Ethers?) where revert reasons
// are not retrieved if the functions are pure.
contract SafeCastMock {
    // solc-ignore-next-line func-mutability
    function int24toInt256(int24 x) external view returns (int256) {
        return SafeCastI24.to256(x);
    }

    // solc-ignore-next-line func-mutability
    function uint256toUint160(uint256 x) external view returns (uint160) {
        return SafeCastU256.to160(x);
    }

    // solc-ignore-next-line func-mutability
    function int256toInt24(int256 x) external view returns (int24) {
        return SafeCastI256.to24(x);
    }

    // solc-ignore-next-line func-mutability
    function uint160toUint256(uint160 x) external view returns (uint256) {
        return SafeCastU160.to256(x);
    }

    // solc-ignore-next-line func-mutability
    function int56toInt24(int56 x) external view returns (int24) {
        return SafeCastI56.to24(x);
    }

    // solc-ignore-next-line func-mutability
    function uint56toInt56(uint56 x) external view returns (int56) {
        return SafeCastU56.toInt(x);
    }

    // solc-ignore-next-line func-mutability
    function uint32toUint56(uint32 x) external view returns (uint56) {
        return SafeCastU32.to56(x);
    }

    // solc-ignore-next-line func-mutability
    function bytes32toUint(bytes32 x) external view returns (uint) {
        return SafeCastBytes32.toUint(x);
    }

    // solc-ignore-next-line func-mutability
    function bytes32toAddress(bytes32 x) external view returns (address) {
        return SafeCastBytes32.toAddress(x);
    }

    // solc-ignore-next-line func-mutability
    function addressToBytes32(address x) external view returns (bytes32) {
        return SafeCastAddress.toBytes32(x);
    }

    // solc-ignore-next-line func-mutability
    function uint256toInt256(uint256 x) external view returns (int256) {
        return SafeCastU256.toInt(x);
    }

    // solc-ignore-next-line func-mutability
    function uint256toBytes32(uint256 x) external view returns (bytes32) {
        return SafeCastU256.toBytes32(x);
    }

    // solc-ignore-next-line func-mutability
    function uint256toUint64(uint256 x) external view returns (uint64) {
        return SafeCastU256.to64(x);
    }

    // solc-ignore-next-line func-mutability
    function uint256toUint32(uint256 x) external view returns (uint32) {
        return SafeCastU256.to32(x);
    }

    // solc-ignore-next-line func-mutability
    function uint256toUint128(uint256 x) external view returns (uint128) {
        return SafeCastU256.to128(x);
    }

    // solc-ignore-next-line func-mutability
    function uint128toBytes32(uint128 x) external view returns (bytes32) {
        return SafeCastU128.toBytes32(x);
    }

    // solc-ignore-next-line func-mutability
    function uint128toInt128(uint128 x) external view returns (int128) {
        return SafeCastU128.toInt(x);
    }

    // solc-ignore-next-line func-mutability
    function uint128toUint256(uint128 x) external view returns (uint256) {
        return SafeCastU128.to256(x);
    }

    // solc-ignore-next-line func-mutability
    function int256toUint256(int256 x) external view returns (uint256) {
        return SafeCastI256.toUint(x);
    }

    // solc-ignore-next-line func-mutability
    function int256toInt128(int256 x) external view returns (int128) {
        return SafeCastI256.to128(x);
    }

    // solc-ignore-next-line func-mutability
    function int128toInt32(int128 x) external view returns (int32) {
        return SafeCastI128.to32(x);
    }

    // solc-ignore-next-line func-mutability
    function int128toInt256(int128 x) external view returns (int256) {
        return SafeCastI128.to256(x);
    }

    // solc-ignore-next-line func-mutability
    function int128toUint128(int128 x) external view returns (uint128) {
        return SafeCastI128.toUint(x);
    }

    // solc-ignore-next-line func-mutability
    function zeroI128() external view returns (int128) {
        return SafeCastI128.zero();
    }

    // solc-ignore-next-line func-mutability
    function zeroI256() external view returns (int256) {
        return SafeCastI256.zero();
    }

    // solc-ignore-next-line func-mutability
    function uint64toInt64(uint64 x) external view returns (int64) {
        return SafeCastU64.toInt(x);
    }

    // solc-ignore-next-line func-mutability
    function int32toUint32(int32 x) external view returns (uint32) {
        return SafeCastI32.toUint(x);
    }

    // solc-ignore-next-line func-mutability
    function uint32toInt32(uint32 x) external view returns (int32) {
        return SafeCastU32.toInt(x);
    }

    // solc-ignore-next-line func-mutability
    function uint32toUint256(uint32 x) external view returns (uint256) {
        return SafeCastU32.to256(x);
    }
}
