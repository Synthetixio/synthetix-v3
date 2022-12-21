//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "./CollateralLock.sol";
import "./Pool.sol";

/**
 * @title Stores information about a deposited asset for a given account.
 *
 * Each account will have one of these objects for each type of collateral it deposited in the system.
 */
library Collateral {
    using SafeCastU256 for uint256;

    struct Data {
        /**
         * @dev Indicates if the collateral is set, i.e. not empty.
         */
        bool isSet;
        /**
         * @dev The amount that can be withdrawn or delegated in this collateral.
         */
        uint256 availableAmountD18;
        /**
         * @dev The pools to which this collateral delegates to.
         */
        SetUtil.UintSet pools;
        /**
         * @dev Marks portions of the collateral as locked,
         * until a given unlock date.
         *
         * Note: Locks apply to collateral delegation (see VaultModule), and not to withdrawing collateral.
         */
        CollateralLock.Data[] locks;
    }

    /**
     * @dev Increments the entry's availableCollateral.
     */
    function deposit(Data storage self, uint amountD18) internal {
        if (!self.isSet) {
            self.isSet = true;
            self.availableAmountD18 = amountD18;
        } else {
            self.availableAmountD18 += amountD18;
        }
    }

    /**
     * @dev Decrements the entry's availableCollateral.
     */
    function deductCollateral(Data storage self, uint amountD18) internal {
        self.availableAmountD18 -= amountD18;
    }

    /**
     * @dev Returns the total amount in this collateral entry that is locked.
     *
     * Sweeps through all existing locks and accumulates their amount,
     * if their unlock date is in the future.
     */
    function getTotalLocked(Data storage self) internal view returns (uint) {
        uint64 currentTime = block.timestamp.to64();

        uint256 lockedD18;
        for (uint i = 0; i < self.locks.length; i++) {
            CollateralLock.Data storage lock = self.locks[i];

            if (lock.lockExpirationTime > currentTime) {
                lockedD18 += lock.amountD18;
            }
        }

        return lockedD18;
    }
}
