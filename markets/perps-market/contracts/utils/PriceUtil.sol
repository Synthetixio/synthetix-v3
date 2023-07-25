//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library PriceUtil {
    /**
     * @notice Calculates the fill price for an order.
     */
    function calculateFillPrice(
        int skew,
        int newSkew,
        uint skewScale,
        int size,
        uint price
    ) internal pure returns (uint) {
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
        if (skewScale == 0) {
            return price;
        }
        // calculate pd (premium/discount) before and after trade
        int pdBefore = skew.divDecimal(skewScale.toInt());
        int pdAfter = newSkew.divDecimal(skewScale.toInt());

        // calculate price before and after trade with pd applied
        int priceBefore = price.toInt() + (price.toInt().mulDecimal(pdBefore));
        int priceAfter = price.toInt() + (price.toInt().mulDecimal(pdAfter));

        // the fill price is the average of those prices
        return (priceBefore + priceAfter).toUint().divDecimal(DecimalMath.UNIT * 2);
    }
}