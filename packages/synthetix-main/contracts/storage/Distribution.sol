//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "./DistributionActor.sol";

library Distribution {
    error InvalidParameters(string incorrectParameter, string help);

    struct Data {
        // total number of shares
        uint128 totalShares;
        // total amount of the distribution
        int128 valuePerShare;
        // used for tracking individual user ids within
        mapping(bytes32 => DistributionActor.Data) actorInfo;
    }

    /**
     * call every time you want to change the distributions, or immediately apply a change to the amount in a distribution
     */
    function distribute(Data storage dist, int amount) internal {
        if (amount == 0) {
            return;
        }

        uint totalShares = dist.totalShares;

        if (totalShares == 0) {
            revert InvalidParameters("amount", "can't distribute to empty distribution");
        }

        // instant distribution--immediately disperse amount
        dist.valuePerShare = int128(dist.valuePerShare) + int128((amount * 1e27) / int(totalShares));
    }

    /**
     * call this if your actor is "crowding in" to a distribution i.e. they are not contributing anything of their own
     * in terms of the value fo this. Example uses:
     * * measuring debt over time
     * * staking rewards
     */
    function updateActorShares(
        Data storage dist,
        bytes32 actorId,
        uint shares
    ) internal returns (int changedValue) {
        DistributionActor.Data storage actor = dist.actorInfo[actorId];

        // use the previous number of shares when calculating the changed amount
        changedValue = (int(dist.valuePerShare - actor.lastValuePerShare) * int(int128(actor.shares))) / 1e27;

        dist.totalShares = uint128(dist.totalShares + shares - actor.shares);

        actor.lastValuePerShare = shares == 0 ? int128(0) : dist.valuePerShare;
        actor.shares = uint128(shares);
    }

    /**
     * same as `updateActorShares`, but doesn't alter the number of shares for the actor
     */
    function accumulateActor(Data storage dist, bytes32 actorId) internal returns (int changedValue) {
        return updateActorShares(dist, actorId, getActorShares(dist, actorId));
    }

    /**
     * call this if your actor is "joining the ride" i.e. they are contributing some value. good use cases for this:
     * * amount of collateral (ex. when the total collateral amount might change over time)
     * note: if you do not expect the global value to be scaled/modified, you might choose to store it as the shares in another crowdin distribution instead
     */
    function updateActorValue(
        Data storage dist,
        bytes32 actorId,
        int value
    ) internal returns (uint shares) {
        if (dist.valuePerShare == 0 && dist.totalShares != 0) {
            revert InvalidParameters("valuePerShare", "shares still exist when no value per share remains");
        }

        if (dist.totalShares == 0) {
            dist.valuePerShare = 1e27;
            shares = uint(value > 0 ? value : -value);
        } else {
            shares = uint((value * int128(dist.totalShares)) / totalValue(dist));
        }

        DistributionActor.Data storage actor = dist.actorInfo[actorId];

        dist.totalShares = uint128(dist.totalShares + shares - actor.shares);

        actor.shares = uint128(shares);
        // lastValuePerShare remains unset because they contributed
    }

    /**
     * get the number of shares recorded for an actor
     */
    function getActorShares(Data storage dist, bytes32 actorId) internal view returns (uint shares) {
        return dist.actorInfo[actorId].shares;
    }

    /**
     * get the total value of the stake
     * note: if you are trying to calculate accumulation i.e. change in staking value, use `updateActorDistribution` instead
     */
    function getActorValue(Data storage dist, bytes32 actorId) internal view returns (int value) {
        return (int(dist.valuePerShare) * int128(dist.actorInfo[actorId].shares)) / 1e27;
    }

    /**
     * get the total value stored in this pool (that is, dist * )
     * note: this value means nothing if you are using a "crowding in" pool scheme. store this value outside if you need it.
     */
    function totalValue(Data storage dist) internal view returns (int value) {
        return (int(dist.valuePerShare) * int128(dist.totalShares)) / 1e27;
    }

    // returns the number of shares a user should be entitled to if they join an existing distribution with the given
    // contribution amount
    function sharesForValue(Data storage dist, int value) internal view returns (uint shares) {
        if (int(dist.valuePerShare) * value < 0) {
            revert InvalidParameters("value", "results in negative shares");
        }

        return uint((value * 1e27) / dist.valuePerShare);
    }
}
