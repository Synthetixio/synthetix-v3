//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library OrderFees {
    struct Data {
        int256 fixedFees;
        int256 utilizationFees;
        int256 skewFees;
        int256 wrapperFees;
    }

    function total(Data memory self) internal pure returns (int256) {
        return self.fixedFees + self.utilizationFees + self.skewFees + self.wrapperFees;
    }
}
