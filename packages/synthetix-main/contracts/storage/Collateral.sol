//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "./Pool.sol";

library Collateral {
    struct Data {
        bool isSet;
        uint256 availableAmount; // adjustable (stake/unstake)
        //CurvesLibrary.PolynomialCurve escrow;
        SetUtil.UintSet pools;
        //StakedCollateralLock[] locks;
    }

    function depositCollateral(Data storage self, uint amount) internal {
        if (!self.isSet) {
            // new collateral
            self.isSet = true;
            self.availableAmount = amount;
        } else {
            self.availableAmount += amount;
        }
    }

    function deductCollateral(Data storage self, uint amount) internal {
        self.availableAmount -= amount;
    }
}
