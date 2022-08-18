//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

library SharesLibrary {

    error InvalidParameters(string incorrectParameter, string help);

    struct DistributionActor {
        uint128 shares; 
        int128 lastValuePerShare;
    }

    struct Distribution {
        // total amount of the distribution
        int128 valuePerShare;
        uint128 totalShares;

        // amount which should be applied to valuePerShare at the given time below, or 
        int128 scheduledValue;
        // set to <= block.timestamp to distribute immediately to currently staked users
        int64 start;
        int32 duration;
        int32 lastUpdate;

        // used for tracking individual user ids within 
        mapping(bytes32 => DistributionActor) actorInfo;
    }

    /**
     * call every time you want to change the distributions, or immediately apply a change to the amount in a distribution
     */
    function distribute(
        Distribution storage dist,
        int amount,
        uint start,
        uint duration
    ) internal {
        int curTime = int128(int(block.timestamp));

        // ensure any previously active distribution has applied
        updateDistribution(dist);

        if (start + duration <= uint(curTime)) {
            // update any rewards which may have accrued since last run

            // instant distribution--immediately disperse amount
            dist.valuePerShare = int128(dist.valuePerShare) + 
                int128(amount * 1e18 / int128(dist.totalShares));
            dist.lastUpdate = int32(curTime);
            dist.start = 0;
            dist.duration = 0;
            dist.scheduledValue = 0;
        }
        else {
            // set distribution schedule
            dist.scheduledValue = int128(amount);
            dist.start = int64(int(start));
            dist.duration = int32(int(duration));

            // the amount is actually the amount distributed already *plus* whatever has been specified now
            dist.lastUpdate = 0;

            updateDistribution(dist);
        }
    }

    /**
     * call every time before `totalShares` changes
     */
    function updateDistribution(
        Distribution storage dist
    ) internal {
        if (dist.scheduledValue == 0 || dist.totalShares == 0) {
            // cannot process distributed rewards if a pool is empty.
            return;
        }

        // exciting type casting here
        int128 curTime = int128(int(block.timestamp));

        if (curTime < dist.start) {
            return;
        }
        
        // determine whether this is an instant distribution or a delayed distribution
        if (dist.duration == 0 && dist.lastUpdate < dist.start) {
            dist.valuePerShare = int128((int(dist.valuePerShare) + dist.scheduledValue) * 1e18 / int128(dist.totalShares));
        } else if (dist.lastUpdate < dist.start + dist.duration) {
            //revert Test(dists[i].start, dists[i].duration, curTime, dists[i].lastUpdate, dists[i].amount);
            // find out what is "newly" distributed
            int128 lastUpdateDistributed = dist.lastUpdate < dist.start ? 
                int128(0) : 
                (dist.scheduledValue * (dist.lastUpdate - dist.start)) / dist.duration;

            

            int128 curUpdateDistributed = dist.scheduledValue;
            if (curTime < dist.start + dist.duration) {
                curUpdateDistributed = (curUpdateDistributed * (curTime - dist.start)) / dist.duration;
            }

            //revert Test(curUpdateDistributed, lastUpdateDistributed, sharesSupply, dists[i].start, curTime);

            dist.valuePerShare += int128(int(curUpdateDistributed - lastUpdateDistributed) * 1e18 / int128(dist.totalShares));
        }

        dist.lastUpdate = int32(curTime);
    }

    function updateDistributionActor(
        Distribution storage dist,
        bytes32 actorId,
        uint shares
    ) internal returns (int changedAmount) {
        updateDistribution(dist);

        DistributionActor storage actor = dist.actorInfo[actorId];

        // use the previous number of shares when calculating the changed amount
        changedAmount = int(int128(actor.shares)) * (dist.valuePerShare - actor.lastValuePerShare) / 1e18;

        dist.totalShares = dist.totalShares + uint128(shares) - actor.shares;

        actor.lastValuePerShare = dist.valuePerShare;
        actor.shares = uint128(shares);
    }

    function getActorValue(
        Distribution storage dist,
        bytes32 actorId
    ) internal view returns (int value) {
        return int(int128(dist.actorInfo[actorId].shares)) * dist.valuePerShare / 1e18;
    }

    function getActorShares(
        Distribution storage dist,
        bytes32 actorId
    ) internal view returns (uint shares) {
        return dist.actorInfo[actorId].shares;
    }

    // returns the number of shares a user should be entitled to if they join an existing distribution with the given
    // contribution amount
    function sharesForValue(
        Distribution storage dist,
        int value
    ) internal view returns (uint shares) {
        if (dist.valuePerShare * value < 0) {
            revert InvalidParameters("value", "results in negative shares");
        }

        return uint(value * 1e18 / dist.valuePerShare);
    }
}
