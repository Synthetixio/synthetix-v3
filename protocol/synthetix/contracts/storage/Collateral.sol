//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "./CollateralLock.sol";

/**
 * @title Stores information about a deposited asset for a given account.
 *
 * Each account will have one of these objects for each type of collateral it deposited in the system.
 */
library Collateral {
    using SafeCastU256 for uint256;

    /**
     * @dev Thrown when a specified market is not found.
     */
    error InsufficentAvailableCollateral(
        uint256 amountAvailableForDelegationD18,
        uint256 amountD18
    );

    /**
     * @notice Emitted when a lock is cleared from an account due to expiration
     * @param tokenAmount The amount of collateral that was unlocked, demoninated in system units (1e18)
     * @param expireTimestamp unix timestamp at which the unlock is due to expire
     */
    event CollateralLockExpired(uint256 tokenAmount, uint64 expireTimestamp);

    struct Data {
        /**
         * @dev The amount that can be withdrawn or delegated in this collateral.
         */
        uint256 amountAvailableForDelegationD18;
        /**
         * @dev The pools to which this collateral delegates to.
         */
        SetUtil.UintSet pools;
        /**
         * @dev Marks portions of the collateral as locked,
         * until a given unlock date.
         *
         * Note: Locks apply to delegated collateral and to collateral not
         * assigned or delegated to a pool (see ICollateralModule).
         */
        CollateralLock.Data[] locks;
    }

    /**
     * @dev Increments the entry's availableCollateral.
     */
    function increaseAvailableCollateral(Data storage self, uint256 amountD18) internal {
        self.amountAvailableForDelegationD18 += amountD18;
    }

    /**
     * @dev Decrements the entry's availableCollateral.
     */
    function decreaseAvailableCollateral(Data storage self, uint256 amountD18) internal {
        if (self.amountAvailableForDelegationD18 < amountD18) {
            revert InsufficentAvailableCollateral(self.amountAvailableForDelegationD18, amountD18);
        }
        self.amountAvailableForDelegationD18 -= amountD18;
    }

    function cleanExpiredLocks(
        Data storage self,
        uint256 offset,
        uint256 count
    ) internal returns (uint256 cleared, uint256 remainingLockAmountD18) {
        uint64 currentTime = block.timestamp.to64();

        uint256 len = self.locks.length;

        if (offset >= len) {
            return (0, 0);
        }

        if (count == 0 || offset + count >= len) {
            count = len - offset;
        }

        uint256 index = offset;
        uint256 totalLocked = 0;
        for (uint256 i = 0; i < count; i++) {
            if (self.locks[index].lockExpirationTime <= currentTime) {
                emit CollateralLockExpired(
                    self.locks[index].amountD18,
                    self.locks[index].lockExpirationTime
                );

                self.locks[index] = self.locks[self.locks.length - 1];
                self.locks.pop();
            } else {
                totalLocked += self.locks[index].amountD18;
                index++;
            }
        }

        return (offset + count - index, totalLocked);
    }

    /**
     * @dev Returns the total amount in this collateral entry that is locked.
     *
     * Sweeps through all existing locks and accumulates their amount,
     * if their unlock date is in the future.
     */
    function getTotalLocked(Data storage self) internal view returns (uint256) {
        uint64 currentTime = block.timestamp.to64();

        uint256 lockedD18;
        for (uint256 i = 0; i < self.locks.length; i++) {
            CollateralLock.Data storage lock = self.locks[i];

            if (lock.lockExpirationTime > currentTime) {
                lockedD18 += lock.amountD18;
            }
        }

        return lockedD18;
    }
}
