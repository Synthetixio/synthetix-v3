//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

library CurvesLibrary {
    using DecimalMath for int256;

    error ValueOutOfRange();
    error InvalidPointsOrder();
    error InvalidCurve();

    struct PolynomialCurve {
        uint start;
        uint end;
        int a;
        int b;
        int c;
    }

    struct Point {
        uint x;
        uint y; // Could it be negative? (in our practical case, not in theory)
    }

    function calculateValueAtCurvePoint(PolynomialCurve memory curve, uint x) internal pure returns (uint y) {
        if (x < curve.start) {
            x = curve.start;
        } else if (x > curve.end) {
            x = curve.end;
        }
        int xInt = int(x);
        return uint(curve.a.mulDecimal(xInt.mulDecimal(xInt)) + curve.b.mulDecimal(xInt) + curve.c);
    }

    function combineCurves(PolynomialCurve memory c1, PolynomialCurve memory c2)
        internal
        view
        returns (PolynomialCurve memory)
    {
        uint start = block.timestamp;
        uint end1 = c1.end > c2.end ? c1.end : c2.end;
        uint end2 = c1.end < c2.end ? c1.end : c2.end;

        // if both curves ends at the same time, pick a point in the middle
        if (end1 == end2) {
            end1 = start + (end2 - start) / 2;
        }

        Point memory p1;
        Point memory p2;
        Point memory p3;

        p1.x = start;
        p1.y = calculateValueAtCurvePoint(c1, start) + calculateValueAtCurvePoint(c2, start);

        p2.x = end2;
        p2.y = calculateValueAtCurvePoint(c1, end2) + calculateValueAtCurvePoint(c2, end2);

        p3.x = end1;
        p3.y = calculateValueAtCurvePoint(c1, end1) + calculateValueAtCurvePoint(c2, end1);

        return generateCurve(p1, p2, p3);
    }

    function generateCurve(
        Point memory p1,
        Point memory p2,
        Point memory p3
    ) internal pure returns (PolynomialCurve memory) {
        // https://math.stackexchange.com/a/680695

        if (p1.x >= p2.x || p2.x >= p3.x) revert InvalidPointsOrder(); // sanity check
        if (p1.x < 0 || p1.y < 0 || p2.y < 0 || p3.y < 0) revert ValueOutOfRange(); // sanity check

        PolynomialCurve memory curve;
        curve.start = p1.x;
        curve.end = p3.x;
        // Int values to do the maths
        int p1x = int(p1.x);
        int p2x = int(p2.x);
        int p3x = int(p3.x);
        int p1y = int(p1.y);
        int p2y = int(p2.y);
        int p3y = int(p3.y);

        curve.a = (p1x.mulDecimal(p3y - p2y) + p2x.mulDecimal(p1y - p3y) + p3x.mulDecimal(p2y - p1y)).divDecimal(
            ((p1x - p2x).mulDecimal((p1x - p3x).mulDecimal(p2x - p3x)))
        );
        curve.b = (p2y - p1y).divDecimal(p2x - p1x) - curve.a.mulDecimal(p1x + p2x);
        curve.c = p1y - curve.a.mulDecimal(p1x.mulDecimal(p1x)) - curve.b.mulDecimal(p1x);

        // TODO REVIEW THIS SANITY CHECK
        int testX = (-curve.b).divDecimal((curve.a * 2));
        require(testX < p1x && testX > p3x, "Function becomes negative"); // sanity check
        // ???? ^ we already stablished that p1x < p3x => if textX is < p1x it can never be > p3x
        // TODO change to use InvalidCurve()

        return curve;
    }
}
