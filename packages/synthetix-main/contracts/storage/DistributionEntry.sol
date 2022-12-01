//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "./Distribution.sol";

library DistributionEntry {
    using DecimalMath for int256;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    struct Data {
        // amount which should be applied at the given time below, or
        int128 scheduledValueD18;
        // set to <= block.timestamp to distribute immediately to currently staked users
        uint64 start;
        uint32 duration;
        uint32 lastUpdate;
    }

    /**
     * this function allows for more special cases such as distributing at a future date or distributing over time.
     * if you want to apply the distribution to the pool, call `distribute` with the return value. Otherwise, you can
     * record this independantly as well
     */
    function distribute(
        Data storage entry,
        Distribution.Data storage dist,
        int amountD18,
        uint64 start,
        uint32 duration
    ) internal returns (int diffD18) {
        uint totalSharesD18 = dist.totalSharesD18;

        if (totalSharesD18 == 0) {
            revert ParameterError.InvalidParameter("amount", "can't distribute to empty distribution");
        }

        int curTime = block.timestamp.toInt().to128();

        // ensure any previously active distribution has applied
        diffD18 += updateEntry(entry, dist.totalSharesD18);

        if (start + duration <= curTime.toUint()) {
            // update any rewards which may have accrued since last run

            // instant distribution--immediately disperse amount
            diffD18 += (amountD18 * 1e18) / totalSharesD18.toInt();

            entry.lastUpdate = 0;
            entry.start = 0;
            entry.duration = 0;
            entry.scheduledValueD18 = 0;
        } else {
            // set distribution schedule
            entry.scheduledValueD18 = amountD18.to128();

            entry.start = start;
            entry.duration = duration;

            // the amount is actually the amount distributed already *plus* whatever has been specified now
            entry.lastUpdate = 0;

            diffD18 += updateEntry(entry, dist.totalSharesD18);
        }
    }

    /**
     * call every time before `totalShares` changes
     */
    function updateEntry(Data storage entry, uint totalSharesAmountD18) internal returns (int) {
        if (entry.scheduledValueD18 == 0 || totalSharesAmountD18 == 0) {
            // cannot process distributed rewards if a pool is empty.
            return 0;
        }

        int128 curTime = block.timestamp.toInt().to128();

        int valuePerShareChangeD18 = 0;

        if (curTime < int64(entry.start)) {
            return 0;
        }

        // determine whether this is an instant distribution or a delayed distribution
        if (entry.duration == 0 && entry.lastUpdate < entry.start) {
            valuePerShareChangeD18 = int(entry.scheduledValueD18).divDecimal(totalSharesAmountD18.toInt());
        } else if (entry.lastUpdate < entry.start + entry.duration) {
            // find out what is "newly" distributed
            int lastUpdateDistributedD18 = entry.lastUpdate < entry.start
                ? int128(0)
                : (entry.scheduledValueD18 * int64(entry.lastUpdate - entry.start)) / int32(entry.duration);

            int curUpdateDistributedD18 = entry.scheduledValueD18;
            if (curTime < int64(entry.start + entry.duration)) {
                curUpdateDistributedD18 = (curUpdateDistributedD18 * (curTime - int64(entry.start))) / int32(entry.duration);
            }

            valuePerShareChangeD18 = (curUpdateDistributedD18 - lastUpdateDistributedD18).divDecimal(
                totalSharesAmountD18.toInt()
            );
        }

        entry.lastUpdate = uint32(int32(curTime));

        return valuePerShareChangeD18;
    }
}
