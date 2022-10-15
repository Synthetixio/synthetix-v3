//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "./CollateralLock.sol";
import "./Pool.sol";

library Collateral {
    struct Data {
        bool isSet;
        uint256 availableAmount; // adjustable (stake/unstake)
        //CurvesLibrary.PolynomialCurve escrow;
        SetUtil.UintSet pools;
        CollateralLock.Data[] locks;
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

    function getTotalLocked(Data storage self) internal view returns (uint) {
        uint64 currentTime = uint64(block.timestamp);

        uint256 locked;
        for (uint i = 0; i < self.locks.length; i++) {
            CollateralLock.Data storage lock = self.locks[i];

            if (lock.lockExpirationTime > currentTime) {
                locked += lock.amount;
            }
        }

        return locked;
    }
}
