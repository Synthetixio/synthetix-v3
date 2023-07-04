//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256, SafeCastU128, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {MathUtil} from "../utils/MathUtil.sol";

/**
 * @dev An order that has yet to be settled for position modification.
 */
library Order {
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using DecimalMath for int128;
    using SafeCastU128 for uint128;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    struct Data {
        uint128 accountId;
        int128 sizeDelta;
        uint256 commitmentTime;
        uint256 desiredFillPrice;
    }

    /**
     * @dev See IOrderModule.fillPrice
     */
    function fillPrice(
        int128 skew,
        uint128 skewScale,
        int128 sizeDelta,
        uint256 oraclePrice
    ) internal pure returns (uint256) {
        // How is the p/d-adjusted price calculated using an example:
        //
        // price      = $1200 USD (oracle)
        // size       = 100
        // skew       = 0
        // skew_scale = 1,000,000 (1M)
        //
        // Then,
        //
        // pd_before = 0 / 1,000,000
        //           = 0
        // pd_after  = (0 + 100) / 1,000,000
        //           = 100 / 1,000,000
        //           = 0.0001
        //
        // price_before = 1200 * (1 + pd_before)
        //              = 1200 * (1 + 0)
        //              = 1200
        // price_after  = 1200 * (1 + pd_after)
        //              = 1200 * (1 + 0.0001)
        //              = 1200 * (1.0001)
        //              = 1200.12
        // Finally,
        //
        // fill_price = (price_before + price_after) / 2
        //            = (1200 + 1200.12) / 2
        //            = 1200.06
        int256 pdBefore = skew.divDecimal(skewScale.toInt());
        int256 pdAfter = (skew + sizeDelta).divDecimal(skewScale.toInt());
        int256 priceBefore = oraclePrice.toInt() + (oraclePrice.toInt().mulDecimal(pdBefore));
        int256 priceAfter = oraclePrice.toInt() + (oraclePrice.toInt().mulDecimal(pdAfter));
        return (priceBefore + priceAfter).toUint().divDecimal(DecimalMath.UNIT * 2);
    }

    /**
     * @dev See IOrderModule.orderFee
     */
    function orderFee(
        int128 sizeDelta,
        uint256 _fillPrice,
        int128 skew,
        uint128 makerFee,
        uint128 takerFee
    ) internal pure returns (uint256) {
        int256 notionalDiff = sizeDelta.mulDecimal(_fillPrice.toInt());

        // Does this trade keep the skew on one side?
        if (MathUtil.sameSide(skew + sizeDelta, skew)) {
            // Use a flat maker/taker fee for the entire size depending on whether the skew is increased or reduced.
            //
            // If the order is submitted on the same side as the skew (increasing it) - the taker fee is charged.
            // otherwise if the order is opposite to the skew, the maker fee is charged.
            uint256 staticRate = MathUtil.sameSide(notionalDiff, skew) ? takerFee : makerFee;
            return MathUtil.abs(notionalDiff.mulDecimal(staticRate.toInt()));
        }

        // This trade flips the skew.
        //
        // the proportion of size that moves in the direction after the flip should not be considered
        // as a maker (reducing skew) as it's now taking (increasing skew) in the opposite direction. hence,
        // a different fee is applied on the proportion increasing the skew.

        // Proportion of size that's on the other direction
        uint256 takerSize = MathUtil.abs((skew + sizeDelta).divDecimal(sizeDelta));
        uint256 makerSize = DecimalMath.UNIT - takerSize;
        return
            MathUtil.abs(notionalDiff).mulDecimal(takerSize).mulDecimal(takerFee) +
            MathUtil.abs(notionalDiff).mulDecimal(makerSize).mulDecimal(makerFee);
    }
}
