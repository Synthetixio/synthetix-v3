//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @notice  A convenience library that includes a Data struct which is used to track fees across different trade types
 */
library OrderFees {
    using SafeCastU256 for uint256;

    struct Data {
        uint256 fixedFees;
        uint256 utilizationFees;
        int256 skewFees;
        int256 wrapperFees;
    }

    function total(Data memory self) internal pure returns (int256 amount) {
        return
            self.fixedFees.toInt() +
            self.utilizationFees.toInt() +
            self.skewFees +
            self.wrapperFees;
    }
}
