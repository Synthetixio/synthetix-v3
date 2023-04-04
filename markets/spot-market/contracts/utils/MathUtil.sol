//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastI256, SafeCastU256} "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

library MathUtil {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using DecimalMath for int256;

    function abs(int x) internal pure returns (uint) {
        return x >= 0 ? x.toUint() : (-x).toUint();
    }

    function max(int x, int y) internal pure returns (int) {
        return x < y ? y : x;
    }

    function min(int x, int y) internal pure returns (int) {
        return x < y ? x : y;
    }

    function min(uint x, uint y) internal pure returns (uint) {
        return x < y ? x : y;
    }

    function sameSide(int a, int b) internal pure returns (bool) {
        return (a == 0) || (b == 0) || (a > 0) == (b > 0);
    }

    function sqrt(int x) internal pure returns (int y) {
        int z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x.divDecimal(z) + z) / 2;
        }
    }

    function pow(int x, uint n) internal pure returns (int r) {
        r = DecimalMath.UNIT_INT;
        while (n > 0) {
            if (n % 2 == 1) {
                r = r.mulDecimal(x);
                n -= 1;
            } else {
                x = x.mulDecimal(x);
                n /= 2;
            }
        }
    }
}
