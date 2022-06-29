contract LiquidationsModule is ILiquidationModule, CollateralMixin, FundMixin {
    function liquidate(
        uint accountId,
        uint fundId,
        address collateralType
    ) external {
        require(_isLiquidatable(accountId, fundId, collateralType), "Cannot liquidate");
        (uint accountDebt, uint collateral) = _accountDebtAndCollateral(fundId, accountId, collateralType);

        // _deleteLiquidityItem
        // reallocate collateral
    }

    function _isLiquidatable(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal returns (bool) {
        return _collateralizationRatio(accountId, fundId, collateralType) < _getCollateralMinimumCRatio(collateralType);
    }

    function isLiquidatable(
        uint accountId,
        uint fundId,
        address collateralType
    ) external returns (bool) {
        return _isLiquidatable(accountId, fundId, collateralType);
    }

    /*
    function liquidateVault() {
        // 'classic' style liquidation for entire value, partial liquidation allow
    }
    */

    // move below to liqudations storage

    // NOTE FOR DB: At the point when the liqudiation occurs, can we look at the current value of the curve to alter the linear entry to 'smooth' it?

    function vestedRewards(uint accountId, LiqudationInformation liquidationsCurve) public view returns (uint) {
        return
            ((liquidationsCurve.accumulated - liquidationsCurve.initialAmount[accountId]) *
                _calculateValueAtCurvePoint(block.timestamp)) / _calculateValueAtCurvePoint(liquidationsCurve.end);
    }

    // mapping vault (fundId + collateralType) as keccak -> liqudation curve
    mapping(bytes32 => PolynomialCurve) liquidationCurves;

    struct LiqudationInformation {
        PolynomialCurve curve;
        mapping(uint => uint) initialAmount; // key is accountId, amount is accumulated when you entered the vault
        uint accumulated; // how much accumulation per debt share (updated before anyone enters/leaves the vaults)
    }

    struct PolynomialCurve {
        uint128 start;
        uint128 end;
        uint a;
        uint b;
        uint c;
    }

    struct Point {
        int x;
        int y;
    }

    function _calculateValueAtCurvePoint(PolynomialCurve curve, int x) internal returns (int y) {
        require(x >= curve.start && x <= curve.end, "x must be in the bound of the curve");
        return curve.a * x * x + curve.b * x + curve.c; // TODO: decimal math
    }

    function _combineCurves(PolynomialCurve c1, PolynomialCurve c2) internal returns (PolynomialCurve) {
        uint start = block.timestamp;
        uint end1 = c1.end > c2.end ? c1.end : c2.end;
        uint end2 = c1.end < c2.end ? c1.end : c2.end;

        Point p1;
        Point p2;
        Point p3;

        p1.x = block.timestamp;
        p1.y = _calculateValueAtCurvePoint(c1, block.timestamp) + _calculateValueAtCurvePoint(c2, block.timestamp);

        p2.x = end2;
        p2.y = _calculateValueAtCurvePoint(c1, end2) + _calculateValueAtCurvePoint(c2, end2);

        p3.x = end1;
        p3.y = _calculateValueAtCurvePoint(c1, end1) + _calculateValueAtCurvePoint(c2, end1);

        return generateCurve(p1, p2, p3);
    }

    function _generateCurve(
        Point p1,
        Point p2,
        Point p3
    ) internal returns (PolynomialCurve) {
        // https://math.stackexchange.com/a/680695
        // TODO: Handle decimal math

        require(p1.x < p2.x && p2.x < p3.x, "Points must be ascending"); // sanity check
        require(p1.x > 0 && p1.y > 0, "All points must have positive values"); // sanity check

        PolynomialCurve curve;
        curve.start = p1.x;
        curve.end = p3.x;
        curve.a =
            (p1.x * (p3.y - p2.y) + p2.x * (p1.y - p3.y) + p3.x * (p2.y - p1.y)) /
            ((p1.x - p2.x) * (p1.x - p3.x) * (p2.x - p3.x));
        curve.b = (p2.y - p1.y) / (p2.x - p1.x) - curve.a * (p1.x + p2.x);
        curve.c = p1.y - curve.a * p1.x * p1.x - curve.b * p1.x;

        int testX = -curve.b / (curve.a * 2);
        require(testX < p1.x && testX > p3.x, "Function becomes negative"); // sanity check

        return curve;
    }
}
