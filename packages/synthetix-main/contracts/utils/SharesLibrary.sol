//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

library SharesLibrary {

    error InvalidParameters(string incorrectParameter, string help);

    struct DistributionActor {
        uint128 shares; 
        int128 lastValuePerShare;
    }

    struct DistributionEntry {
        // amount which should be applied to valuePerShare at the given time below, or 
        int128 scheduledValue;
        // set to <= block.timestamp to distribute immediately to currently staked users
        int64 start;
        int32 duration;
        int32 lastUpdate;
    }

    struct Distribution {
        // total number of shares
        uint128 totalShares;
        // total amount of the distribution
        int128 valuePerShare;

        // used for tracking individual user ids within 
        mapping(bytes32 => DistributionActor) actorInfo;
    }

    /**
     * call every time you want to change the distributions, or immediately apply a change to the amount in a distribution
     */
    function distribute(
        Distribution storage dist,
        int amount
    ) internal {
        if (amount == 0) {
            return;
        }

        uint totalShares = dist.totalShares;

        if (totalShares == 0) {
            revert InvalidParameters("amount", "can't distribute to empty distribution");
        }

        // instant distribution--immediately disperse amount
        dist.valuePerShare = int128(dist.valuePerShare) + 
            int128(amount * 1e27 / int(totalShares));
    }

    /**
     * this function allows for more special cases such as distributing at a future date or distributing over time.
     * if you want to apply the distribution to the pool, call `distribute` with the return value. Otherwise, you can
     * record this independantly as well
     */
    function distributeWithEntry(
        Distribution storage dist,
        DistributionEntry storage entry, 
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
            diff += amount * 1e18 / int(totalShares);

            entry.lastUpdate = 0;
            entry.start = 0;
            entry.duration = 0;
            entry.scheduledValue = 0;
        }
        else {
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
    function updateEntry(
        DistributionEntry storage entry,
        uint totalSharesAmount
    ) internal returns (int128) {
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
            valuePerShareChange = int(entry.scheduledValue) * 1e18 / int(totalSharesAmount);
        } else if (entry.lastUpdate < entry.start + entry.duration) {
            // find out what is "newly" distributed
            int lastUpdateDistributed = entry.lastUpdate < entry.start ? 
                int128(0) : 
                int(entry.scheduledValue) * (entry.lastUpdate - entry.start) / entry.duration;

            

            int curUpdateDistributed = entry.scheduledValue;
            if (curTime < entry.start + entry.duration) {
                curUpdateDistributed = curUpdateDistributed * (curTime - entry.start) / entry.duration;
            }

            valuePerShareChange = int(curUpdateDistributed - lastUpdateDistributed) * 1e18 / int(totalSharesAmount);
        }

        entry.lastUpdate = int32(curTime);

        return int128(valuePerShareChange);
    }

    /**
     * call this if your actor is "crowding in" to a distribution i.e. they are not contributing anything of their own
     * in terms of the value fo this. Example uses:
     * * measuring debt over time
     * * staking rewards
     */
    function updateActorShares(
        Distribution storage dist,
        bytes32 actorId,
        uint shares
    ) internal returns (int changedValue) {
        DistributionActor storage actor = dist.actorInfo[actorId];

        // use the previous number of shares when calculating the changed amount
        changedValue = int(dist.valuePerShare - actor.lastValuePerShare) * int(int128(actor.shares)) / 1e27;

        dist.totalShares = uint128(dist.totalShares + shares - actor.shares);

        actor.lastValuePerShare = dist.valuePerShare;
        actor.shares = uint128(shares);
    }

    /**
     * same as `updateActorShares`, but doesn't alter the number of shares for the actor
     */
    function accumulateActor(
        Distribution storage dist,
        bytes32 actorId
    ) internal returns (int changedValue) {
        return updateActorShares(
            dist,
            actorId,
            getActorShares(dist, actorId)
        );
    }

    /**
     * call this if your actor is "joining the ride" i.e. they are contributing some value. good use cases for this:
     * * amount of collateral (ex. when the total collateral amount might change over time)
     * note: if you do not expect the global value to be scaled/modified, you might choose to store it as the shares in another crowdin distribution instead
     */
    function updateActorValue(
        Distribution storage dist,
        bytes32 actorId,
        int value
    ) internal returns (uint shares) {
        if (dist.valuePerShare == 0 && dist.totalShares != 0) {
            revert InvalidParameters("valuePerShare", "shares still exist when no value per share remains");
        }

        if (dist.totalShares == 0) {
            dist.valuePerShare = 1e27;
            shares = uint(value > 0 ? value : -value);
        }
        else {
            shares = uint((value * int128(dist.totalShares)) / totalValue(dist));
        }

        DistributionActor storage actor = dist.actorInfo[actorId];

        dist.totalShares = uint128(dist.totalShares + shares - actor.shares);

        actor.shares = uint128(shares);
        // lastValuePerShare remains unset because they contributed
        
    }

    /**
     * get the number of shares recorded for an actor
     */
    function getActorShares(
        Distribution storage dist,
        bytes32 actorId
    ) internal view returns (uint shares) {
        return dist.actorInfo[actorId].shares;
    }

    /**
     * get the total value of the stake
     * note: if you are trying to calculate accumulation i.e. change in staking value, use `updateActorDistribution` instead
     */
    function getActorValue(
        Distribution storage dist,
        bytes32 actorId
    ) internal view returns (int value) {
        return int(dist.valuePerShare) * int128(dist.actorInfo[actorId].shares) / 1e27;
    }

    /**
     * get the total value stored in this pool (that is, dist * )
     * note: this value means nothing if you are using a "crowding in" pool scheme. store this value outside if you need it.
     */
    function totalValue(
        Distribution storage dist
    ) internal view returns (int value) {
        return (int(dist.valuePerShare) * int128(dist.totalShares)) / 1e27;
    }

    // returns the number of shares a user should be entitled to if they join an existing distribution with the given
    // contribution amount
    function sharesForValue(
        Distribution storage dist,
        int value
    ) internal view returns (uint shares) {
        if (int(dist.valuePerShare) * value < 0) {
            revert InvalidParameters("value", "results in negative shares");
        }

        return uint(value * 1e27 / dist.valuePerShare);
    }
}
