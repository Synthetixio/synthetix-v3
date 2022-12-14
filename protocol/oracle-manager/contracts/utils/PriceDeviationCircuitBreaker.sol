// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";

library PriceDeviationCircuitBreaker {
    error InvalidPrice();
    error DeviationToleranceExceeded(int256 deviation);

    function process(
        Node.Data[] memory prices,
        bytes memory parameters
    ) internal pure returns (Node.Data memory) {
        uint256 deviationTolerance = abi.decode(parameters, (uint256));

        int256 price1 = prices[0].price;
        int256 price2 = prices[1].price;

        if (price1 == 0) {
            revert InvalidPrice();
        }

        if (price1 != price2) {
            int256 difference = abs(price1 - price2);
            if (int256(deviationTolerance) < ((difference * 100) / price1)) {
                revert DeviationToleranceExceeded(difference / price1);
            }
        }

        return prices[0];
    }

    function abs(int256 x) private pure returns (int256) {
        return x >= 0 ? x : -x;
    }
}
