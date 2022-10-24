//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "./CollateralLock.sol";
import "./Pool.sol";

/**
 * @title Stores information about a deposited asset for a given account.
 *
 * This is not a global data structure, but rather one that will have an entry for each account > asset pair.
 *
 * That is, accounts have one of these data structures for each type of collateral they utilize.
 *
 * TODO: Consider renaming to CollateralEntry to indicate that this is just an entry, rather than a global thing.
 */
library Collateral {
    struct Data {
        /**
         * @dev Indicates if the collateral entry is set, i.e. not empty.
         *
         * TODO: This is currently not used in the code. Consider removing.
         */
        bool isSet;
        /**
         * @dev The amount that can be withdrawn or delegated in this collateral entry.
         */
        uint256 availableAmount;
        /**
         * @dev The pools to which this collateral entry delegates to.
         */
        SetUtil.UintSet pools;
        /**
         * @dev Marks portions of the collateral as locked,
         * until a given unlock date.
         *
         * TODO: Is the implementation of this finished? Atm, it may seem that Collateral
         * can be withdrawn, even if it has been locked. I.e. the calculation of how
         * much collateral is available does not consider this at all. Withdrawing
         * collateral does not modify locks either.
         */
        CollateralLock.Data[] locks;
        /**
         * @dev TODO
         */
        // CurvesLibrary.PolynomialCurve escrow;
    }

    /**
     * @dev Increments the entry's availableCollateral.
     */
    function depositCollateral(Data storage self, uint amount) internal {
        if (!self.isSet) {
            self.isSet = true;
            self.availableAmount = amount;
        } else {
            self.availableAmount += amount;
        }
    }

    /**
     * @dev Decrements the entry's availableCollateral.
     */
    function deductCollateral(Data storage self, uint amount) internal {
        self.availableAmount -= amount;
    }

    /**
     * @dev Returns the total amount in this collateral entry that is locked.
     *
     * Sweeps through all existing locks and accumulates the its amount
     * if its unlock date is in the future.
     */
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
