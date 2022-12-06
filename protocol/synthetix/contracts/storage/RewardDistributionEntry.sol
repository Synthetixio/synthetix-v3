//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "./Distribution.sol";

/**
 * @title Data structure that holds a certain amount of value, to be distributed as rewards between a given set of dates.
 */
library RewardDistributionEntry {
    using DecimalMath for int256;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    struct Data {
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
    }

    /**
     * @dev Distributes rewards into a new rewards distribution entry.
     *
     * Note: this function allows for more special cases such as distributing at a future date or distributing over time.
     * If you want to apply the distribution to the pool, call `distribute` with the return value. Otherwise, you can
     * record this independently as well.
     */
    function distribute(
        Data storage entry,
        Distribution.Data storage dist,
        int256 amountD18,
        uint64 start,
        uint32 duration
    ) internal returns (int256 diffD18) {
        uint256 totalSharesD18 = dist.totalSharesD18;

        if (totalSharesD18 == 0) {
            revert ParameterError.InvalidParameter(
                "amount",
                "can't distribute to empty distribution"
            );
        }

        int256 curTime = block.timestamp.toInt().to128();

        // Unlocks the entry's distributed amount into its value per share.
        diffD18 += updateEntry(entry, dist.totalSharesD18);

        // If the current time is past the end of the entry's duration,
        // update any rewards which may have accrued since last run.
        // (instant distribution--immediately disperse amount).
        if (start + duration <= curTime.toUint()) {
            diffD18 += amountD18.divDecimal(totalSharesD18.toInt());

            entry.lastUpdate = 0;
            entry.start = 0;
            entry.duration = 0;
            entry.scheduledValueD18 = 0;
            // Else, schedule the amount to distribute.
        } else {
            entry.scheduledValueD18 = amountD18.to128();

            entry.start = start;
            entry.duration = duration;

            // The amount is actually the amount distributed already *plus* whatever has been specified now.
            entry.lastUpdate = 0;

            diffD18 += updateEntry(entry, dist.totalSharesD18);
        }
    }

    /**
     * @dev Updates the total shares of a reward distribution entry, and releases its unlocked value into its value per share, depending on the time elapsed since the start of the distribution's entry.
     *
     * Note: call every time before `totalShares` changes.
     */
    function updateEntry(
        Data storage entry,
        uint256 totalSharesAmountD18
    ) internal returns (int256) {
        // Cannot process distributed rewards if a pool is empty or if it has no rewards.
        if (entry.scheduledValueD18 == 0 || totalSharesAmountD18 == 0) {
            return 0;
        }

        int128 curTime = block.timestamp.toInt().to128();

        int256 valuePerShareChangeD18 = 0;

        // Cannot update an entry whose start date has not being reached.
        if (curTime < int64(entry.start)) {
            return 0;
        }

        // If the entry's duration is zero and the its last update is zero,
        // consider the entry to be an instant distribution.
        if (entry.duration == 0 && entry.lastUpdate < entry.start) {
            // Simply update the value per share to the total value divided by the total shares.
            valuePerShareChangeD18 = int256(entry.scheduledValueD18).divDecimal(
                totalSharesAmountD18.toInt()
            );
            // Else, if the last update was before the end of the duration.
        } else if (entry.lastUpdate < entry.start + entry.duration) {
            // Determine how much was previously distributed.
            // If the last update is zero, then nothing was distributed,
            // otherwise the amount is proportional to the time elapsed since the start.
            int256 lastUpdateDistributedD18 = entry.lastUpdate < entry.start
                ? int128(0)
                : (entry.scheduledValueD18 * int64(entry.lastUpdate - entry.start)) /
                    int32(entry.duration);

            // If the current time is beyond the duration, then consider all scheduled value to be distributed.
            // Else, the amount distributed is proportional to the elapsed time.
            int256 curUpdateDistributedD18 = entry.scheduledValueD18;
            if (curTime < int64(entry.start + entry.duration)) {
                curUpdateDistributedD18 =
                    (curUpdateDistributedD18 * (curTime - int64(entry.start))) /
                    int32(entry.duration);
            }

            // The final value per share change is the difference between what is to be distributed and what was distributed.
            valuePerShareChangeD18 = (curUpdateDistributedD18 - lastUpdateDistributedD18)
                .divDecimal(totalSharesAmountD18.toInt());
        }

        entry.lastUpdate = uint32(int32(curTime));

        return valuePerShareChangeD18;
    }
}
