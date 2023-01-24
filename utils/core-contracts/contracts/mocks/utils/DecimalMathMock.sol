//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../utils/DecimalMath.sol";

contract DecimalMathMock {
    // -----------------
    // uint256
    // -----------------

    function mulDecimal(uint256 x, uint256 y) public pure returns (uint256) {
        return DecimalMath.mulDecimal(x, y);
    }

    function divDecimal(uint256 x, uint256 y) public pure returns (uint256) {
        return DecimalMath.divDecimal(x, y);
    }

    function upscale(uint x, uint factor) public pure returns (uint) {
        return DecimalMath.upscale(x, factor);
    }

    function downscale(uint x, uint factor) public pure returns (uint) {
        return DecimalMath.downscale(x, factor);
    }

    // -----------------
    // uint128
    // -----------------

    function mulDecimalUint128(uint128 x, uint128 y) public pure returns (uint128) {
        return DecimalMath.mulDecimalUint128(x, y);
    }

    function divDecimalUint128(uint128 x, uint128 y) public pure returns (uint128) {
        return DecimalMath.divDecimalUint128(x, y);
    }

    function upscaleUint128(uint128 x, uint factor) public pure returns (uint128) {
        return DecimalMath.upscaleUint128(x, factor);
    }

    function downscaleUint128(uint128 x, uint factor) public pure returns (uint128) {
        return DecimalMath.downscaleUint128(x, factor);
    }

    // -----------------
    // int256
    // -----------------

    function mulDecimal(int256 x, int256 y) public pure returns (int256) {
        return DecimalMath.mulDecimal(x, y);
    }

    function divDecimal(int256 x, int256 y) public pure returns (int256) {
        return DecimalMath.divDecimal(x, y);
    }

    function upscale(int x, uint factor) public pure returns (int) {
        return DecimalMath.upscale(x, factor);
    }

    function downscale(int x, uint factor) public pure returns (int) {
        return DecimalMath.downscale(x, factor);
    }

    // -----------------
    // int128
    // -----------------

    function mulDecimalInt128(int128 x, int128 y) public pure returns (int128) {
        return DecimalMath.mulDecimalInt128(x, y);
    }

    function divDecimalInt128(int128 x, int128 y) public pure returns (int128) {
        return DecimalMath.divDecimalInt128(x, y);
    }

    function upscale(int128 x, uint factor) public pure returns (int128) {
        return DecimalMath.upscaleInt128(x, factor);
    }

    function downscale(int128 x, uint factor) public pure returns (int128) {
        return DecimalMath.downscaleInt128(x, factor);
    }
}
