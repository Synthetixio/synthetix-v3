//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../interfaces/external/IRewardDistributor.sol";

import "./Distribution.sol";
import "./RewardDistributionClaimStatus.sol";

/**
 * @title Used by vaults to track rewards for its participants. There will be one of these for each pool, collateral type, and distributor combination.
 */
library RewardDistribution {
    using DecimalMath for int256;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using SafeCastU64 for uint64;
    using SafeCastU32 for uint32;
    using SafeCastI32 for int32;

    struct Data {
        /**
         * @dev The 3rd party smart contract which holds/mints tokens for distributing rewards to vault participants.
         */
        IRewardDistributor distributor;
        /**
         * @dev Available slot.
         */
        uint128 __slotAvailableForFutureUse;
        /**
         * @dev The value of the rewards in this entry.
         */
        uint128 rewardPerShareD18;
        /**
         * @dev The status for each actor, regarding this distribution's entry.
         */
        mapping(uint256 => RewardDistributionClaimStatus.Data) claimStatus;
        /**
         * @dev Value to be distributed as rewards in a scheduled form.
         */
        int128 scheduledValueD18;
        /**
         * @dev Date at which the entry's rewards will begin to be claimable.
         *
         * Note: Set to <= block.timestamp to distribute immediately to currently participating users.
         */
        uint64 start;
        /**
         * @dev Time span after the start date, in which the whole of the entry's rewards will become claimable.
         */
        uint32 duration;
        /**
         * @dev Date on which this distribution entry was last updated.
         */
        uint32 lastUpdate;
        /**
         * @dev Value to be distributed as rewards in a scheduled form. This value is set to `scheduledValueD18` after the start + duration is elapsed
         */
        int128 nextScheduledValueD18;
        /**
         * @dev Date at which the entry's rewards will begin to be claimable. This value is set to `scheduledValueD18` after the start + duration is elapsed
         *
         * Note: Set to <= block.timestamp to distribute immediately to currently participating users.
         */
        uint64 nextStart;
        /**
         * @dev Time span after the start date, in which the whole of the entry's rewards will become claimable. This value is set to `scheduledValueD18` after the start + duration is elapsed
         */
        uint32 nextDuration;
    }

    /**
     * @dev Distributes rewards into a new rewards distribution entry.
     *
     * Note: this function allows for more special cases such as distributing at a future date or distributing over time.
     * If you want to apply the distribution to the pool, call `distribute` with the return value. Otherwise, you can
     * record this independently as well.
     */
    function distribute(
        Data storage self,
        Distribution.Data storage dist,
        int256 amountD18,
        uint64 start,
        uint32 duration
    ) internal returns (int256 diffD18, int256 cancelledAmount) {
        uint256 totalSharesD18 = dist.totalSharesD18;

        if (totalSharesD18 == 0) {
            revert ParameterError.InvalidParameter(
                "amount",
                "cannot distribute to empty distribution"
            );
        }

        uint256 curTime = block.timestamp;

        // Unlocks the entry's distributed amount into its value per share.
        diffD18 += updateEntry(self, totalSharesD18);

        // no matter what distribution gets applied, the next scheduled value (if any) gets cancelled)
        cancelledAmount = self.nextScheduledValueD18;

        // is this going to be a new active distribution, or a next distribution?
        // its an active distribution if there is no "active" distribution, or if the new distribution starts before the end of the current active distro
        if (
            start == 0 ||
            self.scheduledValueD18 == 0 ||
            curTime > self.start + self.duration ||
            start < self.start + self.duration
        ) {
            if (curTime < self.start || start < self.start || self.duration == 0) {
                cancelledAmount += self.scheduledValueD18;
            } else {
                cancelledAmount +=
                    (self.scheduledValueD18 * (self.start + self.duration - curTime).toInt()) /
                    self.duration.toInt();
            }
            self.nextScheduledValueD18 = 0;
            self.nextStart = 0;
            self.nextDuration = 0;
            self.scheduledValueD18 = amountD18.to128();
            self.start = start;
            self.duration = duration;
            self.lastUpdate = 0;
            diffD18 += updateEntry(self, totalSharesD18);
            // its a next distribution if none of the above applies
        } else {
            self.nextScheduledValueD18 = amountD18.to128();
            self.nextStart = start;
            self.nextDuration = duration;
        }
    }

    /**
     * @dev Gets the total shares of a reward distribution entry.
     */
    function getEntry(
        Data storage self,
        uint256 totalSharesAmountD18
    ) internal view returns (int256) {
        // No balance if a pool is empty or if it has no rewards
        if (self.scheduledValueD18 == 0 || totalSharesAmountD18 == 0) {
            return 0;
        }

        uint256 curTime = block.timestamp;

        int256 valuePerShareChangeD18 = 0;

        // No balance if current time is before start time
        if (curTime < self.start) {
            return 0;
        }

        // If the entry's duration is zero and its last update was before the start time,
        // consider the entry to be an instant distribution.
        if (self.duration == 0 && self.lastUpdate < self.start) {
            // Simply update the value per share to the total value divided by the total shares.
            valuePerShareChangeD18 = self.scheduledValueD18.to256().divDecimal(
                totalSharesAmountD18.toInt()
            );
            // Else, if the last update was before the end of the duration.
        } else if (self.lastUpdate < self.start + self.duration) {
            // Determine how much was previously distributed.
            // If the last update is zero, then nothing was distributed,
            // otherwise the amount is proportional to the time elapsed since the start.
            int256 lastUpdateDistributedD18 = self.lastUpdate < self.start
                ? SafeCastI128.zero()
                : (self.scheduledValueD18 * (self.lastUpdate - self.start).toInt()) /
                    self.duration.toInt();

            // If the current time is beyond the duration, then consider all scheduled value to be distributed.
            // Else, the amount distributed is proportional to the elapsed time.
            int256 curUpdateDistributedD18 = self.scheduledValueD18;
            if (curTime < self.start + self.duration) {
                // Note: Not using an intermediate time ratio variable
                // in the following calculation to maintain precision.
                curUpdateDistributedD18 =
                    (curUpdateDistributedD18 * (curTime - self.start).toInt()) /
                    self.duration.toInt();
            }

            // The final value per share change is the difference between what is to be distributed and what was distributed.
            valuePerShareChangeD18 = (curUpdateDistributedD18 - lastUpdateDistributedD18)
                .divDecimal(totalSharesAmountD18.toInt());
        }

        return valuePerShareChangeD18;
    }

    /**
     * @dev Updates the total shares of a reward distribution entry, and releases its unlocked value into its value per share, depending on the time elapsed since the start of the distribution's entry.
     *
     * Note: call every time before `totalShares` changes.
     */
    function updateEntry(
        Data storage self,
        uint256 totalSharesAmountD18
    ) internal returns (int256) {
        // Cannot process distributed rewards if a pool is empty or if it has no rewards.
        if (self.scheduledValueD18 == 0 || totalSharesAmountD18 == 0) {
            return 0;
        }

        uint256 curTime = block.timestamp;

        int256 valuePerShareChangeD18 = 0;

        // Cannot update an entry whose start date has not being reached.
        if (curTime < self.start) {
            return 0;
        }

        // If the entry's duration is zero and its last update was before the start time,
        // consider the entry to be an instant distribution.
        if (self.duration == 0 && self.lastUpdate < self.start) {
            // Simply update the value per share to the total value divided by the total shares.
            valuePerShareChangeD18 = self.scheduledValueD18.to256().divDecimal(
                totalSharesAmountD18.toInt()
            );
            // Else, if the last update was before the end of the duration.
        } else if (self.lastUpdate < self.start + self.duration) {
            // Determine how much was previously distributed.
            // If the last update is zero, then nothing was distributed,
            // otherwise the amount is proportional to the time elapsed since the start.
            int256 lastUpdateDistributedD18 = 0;

            if (self.lastUpdate >= self.start) {
                // solhint-disable numcast/safe-cast
                lastUpdateDistributedD18 =
                    (int256(self.scheduledValueD18) * (self.lastUpdate - self.start).toInt()) /
                    self.duration.toInt();
                // solhint-enable numcast/safe-cast
            }

            // If the current time is beyond the duration, then consider all scheduled value to be distributed.
            // Else, the amount distributed is proportional to the elapsed time.
            int256 curUpdateDistributedD18 = self.scheduledValueD18;
            if (curTime < self.start + self.duration) {
                // Note: Not using an intermediate time ratio variable
                // in the following calculation to maintain precision.
                curUpdateDistributedD18 =
                    (self.scheduledValueD18 * (curTime - self.start).toInt()) /
                    self.duration.toInt();
            }

            // The final value per share change is the difference between what is to be distributed and what was distributed.
            valuePerShareChangeD18 += (curUpdateDistributedD18 - lastUpdateDistributedD18)
                .divDecimal(totalSharesAmountD18.toInt());
        }

        // cycle to the new distribution if it exists
        if (curTime >= self.start + self.duration) {
            // if we have reached the end of the distribution, we should cycle through to the next distribution (if any)
            self.start = self.nextStart;
            self.duration = self.nextDuration;
            self.scheduledValueD18 = self.nextScheduledValueD18;
            self.nextStart = 0;
            self.nextDuration = 0;
            self.nextScheduledValueD18 = 0;

            // start processing the new entry also
            valuePerShareChangeD18 += updateEntry(self, totalSharesAmountD18);
        }

        self.lastUpdate = curTime.to32();

        return valuePerShareChangeD18;
    }
}
