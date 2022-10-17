//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "./Distribution.sol";

library DistributionEntry {
    error InvalidParameters(string incorrectParameter, string help);

    struct Data {
        // amount which should be applied to valuePerShare at the given time below, or
        int128 scheduledValue;
        // set to <= block.timestamp to distribute immediately to currently staked users
        int64 start;
        int32 duration;
        int32 lastUpdate;
    }

    /**
     * this function allows for more special cases such as distributing at a future date or distributing over time.
     * if you want to apply the distribution to the pool, call `distribute` with the return value. Otherwise, you can
     * record this independantly as well
     */
    function distribute(
        Data storage entry,
        Distribution.Data storage dist,
        int amount,
        uint start,
        uint duration
    ) internal returns (int diff) {
        uint totalShares = dist.totalShares;

        if (totalShares == 0) {
            revert InvalidParameters("amount", "can't distribute to empty distribution");
        }

        int curTime = int128(int(block.timestamp));

        // ensure any previously active distribution has applied
        diff += updateEntry(entry, dist.totalShares);

        if (start + duration <= uint(curTime)) {
            // update any rewards which may have accrued since last run

            // instant distribution--immediately disperse amount
            diff += (amount * 1e18) / int(totalShares);

            entry.lastUpdate = 0;
            entry.start = 0;
            entry.duration = 0;
            entry.scheduledValue = 0;
        } else {
            // set distribution schedule
            entry.scheduledValue = int128(amount);
            entry.start = int64(int(start));
            entry.duration = int32(int(duration));

            // the amount is actually the amount distributed already *plus* whatever has been specified now
            entry.lastUpdate = 0;

            diff += updateEntry(entry, dist.totalShares);
        }
    }

    /**
     * call every time before `totalShares` changes
     */
    function updateEntry(Data storage entry, uint totalSharesAmount) internal returns (int128) {
        if (entry.scheduledValue == 0 || totalSharesAmount == 0) {
            // cannot process distributed rewards if a pool is empty.
            return 0;
        }

        // exciting type casting here
        int128 curTime = int128(int(block.timestamp));

        int valuePerShareChange = 0;

        if (curTime < entry.start) {
            return 0;
        }

        // determine whether this is an instant distribution or a delayed distribution
        if (entry.duration == 0 && entry.lastUpdate < entry.start) {
            valuePerShareChange = (int(entry.scheduledValue) * 1e18) / int(totalSharesAmount);
        } else if (entry.lastUpdate < entry.start + entry.duration) {
            // find out what is "newly" distributed
            int lastUpdateDistributed = entry.lastUpdate < entry.start
                ? int128(0)
                : (int(entry.scheduledValue) * (entry.lastUpdate - entry.start)) / entry.duration;

            int curUpdateDistributed = entry.scheduledValue;
            if (curTime < entry.start + entry.duration) {
                curUpdateDistributed = (curUpdateDistributed * (curTime - entry.start)) / entry.duration;
            }

            valuePerShareChange = (int(curUpdateDistributed - lastUpdateDistributed) * 1e18) / int(totalSharesAmount);
        }

        entry.lastUpdate = int32(curTime);

        return int128(valuePerShareChange);
    }
}
