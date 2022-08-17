//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

library SharesLibrary {

    error InvalidParameters(string incorrectParameter, string help);

    struct Distribution {
        // total amount of the distribution
        uint128 amountPerShare;

        // amount which should be applied to amountPerShare at the given time below, or 
        int128 amount;
        // set to <= block.timestamp to distribute immediately to currently staked users
        int64 start;
        int64 duration;
        int64 lastUpdate;

        // used for tracking individual user ids within 
        mapping(uint => uint128) lastAccumulated;
    }

    /**
     * call every time you want to change the distributions, or immediately apply a change to the amount in a distribution
     */
    function distribute(
        Distribution storage dist,
        uint sharesSupply,
        int amount,
        uint start,
        uint duration
    ) internal {
        int curTime = int128(int(block.timestamp));

        // ensure any previously active distribution has applied
        updateDistribution(dist, sharesSupply);

        if (start + duration <= uint(curTime)) {
            // update any rewards which may have accrued since last run

            // instant distribution--immediately disperse amount
            dist.amountPerShare = uint128(
                int128(dist.amountPerShare) + 
                int128(amount * 1e18 / int(sharesSupply))
            );
            dist.lastUpdate = int64(curTime);
            dist.start = 0;
            dist.duration = 0;
            dist.amount = 0;
        }
        else {
            // set distribution schedule
            dist.amount = int128(amount);
            dist.start = int64(int(start));
            dist.duration = int64(int(duration));

            // the amount is actually the amount distributed already *plus* whatever has been specified now
            dist.lastUpdate = 0;

           updateDistribution(dist, sharesSupply);
        }
    }

    /**
     * call every time before `sharesSupply` changes
     */
    function updateDistribution(
        Distribution storage dist,
        uint sharesSupply
    ) internal {
        if (sharesSupply == 0) {
            // cannot process distributed rewards if a pool is empty.

            revert InvalidParameters("sharesSupply", "Supply cannot be 0");
        }

        // exciting type casting here
        int128 curTime = int128(int(block.timestamp));

        if (curTime < dist.start) {
            return;
        }
        
        // determine whether this is an instant distribution or a delayed distribution
        if (dist.duration == 0 && dist.lastUpdate < dist.start) {
            dist.amountPerShare = uint128(int128(dist.amountPerShare) + dist.amount) * 1e18 / uint128(sharesSupply);
        } else if (dist.lastUpdate < dist.start + dist.duration) {
            //revert Test(dists[i].start, dists[i].duration, curTime, dists[i].lastUpdate, dists[i].amount);
            // find out what is "newly" distributed
            int128 lastUpdateDistributed = dist.lastUpdate < dist.start ? 
                int128(0) : 
                (dist.amount * (dist.lastUpdate - dist.start)) / dist.duration;

            

            int128 curUpdateDistributed = dist.amount;
            if (curTime < dist.start + dist.duration) {
                curUpdateDistributed = (curUpdateDistributed * (curTime - dist.start)) / dist.duration;
            }

            //revert Test(curUpdateDistributed, lastUpdateDistributed, sharesSupply, dists[i].start, curTime);

            dist.amountPerShare += uint128(curUpdateDistributed - lastUpdateDistributed) * 1e18 / uint128(sharesSupply);
        }

        dist.lastUpdate = int64(curTime);
    }

    function updateDistributionActor(
        Distribution storage dist,
        uint accountId,
        uint shares,
        uint sharesSupply
    ) internal returns (int changedAmount) {
        updateDistribution(dist, sharesSupply);

        changedAmount = int(shares) * (int128(dist.amountPerShare) - int128(dist.lastAccumulated[accountId])) / 1e18;

        dist.lastAccumulated[accountId] = dist.amountPerShare;
    }

    function sharesToAmount(
        uint totalShares,
        uint totalAmount,
        uint shares
    ) internal pure returns (uint) {
        return totalShares == 0 ? 0 : shares * totalAmount / totalShares;
    }

    function amountToShares(
        uint totalShares,
        uint totalAmount,
        uint amount
    ) internal pure returns (uint) {
        return totalAmount == 0 ? amount : amount * totalShares / totalAmount;
    }
}
