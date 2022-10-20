//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "./DistributionActor.sol";

/**
 // TODO: Remove USD, it can be other tokens or quantity
 * @title Tracks value, which can be any quantity, distributed amongst a set of actors using shares.
 *
 * A share represents a unit in which the total value is distributed. The total value is `totalShares * valuePerShare`.
 *
 * Actors can be anything, not just addresses, and are thus bytes32. I.e. an accountId, a poolId, etc.
 *
 * Example:
 * 1) The distribution is initialized with a single actor and a value of 100 USD
 * - shares:
 *   - actor1: 1 (100 USD)
 * - totalShares: 1 (100 USD)
 * - valuePerShare: 100 USD
 * - totalValue: 100 USD
 * 2) Another actor enters the distribution with 50 USD of value
 * - shares:
 *   - actor1: 1 (100 USD)
 *   - actor2: 0.5 (50 USD)
 * - totalShares: 1.5 (150 USD)
 * - valuePerShare: 100 USD
 * - totalValue: 150 USD
 * 3) 10 new actors enter the distribution with 10 USD value each
 * - shares:
 *   - actor1: 1 (100 USD)
 *   - actor2: 0.5 (50 USD)
 *   - actor3-actor10: 0.1 (10 USD)
 * - totalShares: 2.5 (250 USD)
 * - valuePerShare: 100 USD
 * - totalValue: 250 USD
 *
 * TODO: Example about actors entering without adding value.
 */
library Distribution {
    /**
     * @notice Thrown when an invalid parameter is used in a function.
     * TODO: Could be deduped and reused in a common Errors library.
     */
    error InvalidParameters(string incorrectParameter, string help);

    /**
     * @dev The properties of a Distribution object.
     */
    struct Data {
        /**
         * @dev The total number of shares in the distribution representing the granularity of the distribution.
         */
        uint128 totalShares;
        /**
         * @dev The value of each share or unit of the distribution.
         *
         * The total value is `totalShares * valuePerShare`.
         *
         * This value is encoded as a precise decimal, that is it has 1e27 decimals instead of the default 1e18.
         * i.e. shares = (value * 1e9).divDecimal(valuePerShare)
         */
        int128 valuePerShare;
        /**
         * @dev Tracks individual actor information, such as how many shares an actor has, etc.
         */
        mapping(bytes32 => DistributionActor.Data) actorInfo;
    }

    /**
     * @dev Adds or removes value to the distribution. The value is
     * distributed into each individual share by altering the distribution's `valuePerShare`.
     *
     * TODO: Consider renaming to distributeValue(). Ok to rename -
     */
    function distribute(Data storage dist, int amount) internal {
        if (amount == 0) {
            return;
        }

        uint totalShares = dist.totalShares;

        if (totalShares == 0) {
            revert InvalidParameters("amount", "can't distribute to empty distribution");
        }

        // TODO: Comment or express why value needs to be multiplied by 1e27
        int128 deltaValuePerShare = int128((amount * 1e27) / int(totalShares));

        dist.valuePerShare += deltaValuePerShare;
    }

    /**
     * @dev Updates an actor's number of shares in the distribution to the specified amount.
     *
     * Modifies the distribution's totalValue, since the number of shares is changed.
     *
     * Eg. if this is used to increase an actor's number of shares, the distribution's total value will increase
     * by deltaShares * valuePerShare.
     *
     * Returns the actor's individual change in value.
     *
     * TODO: I don't yet understand the purpose of lastValuePerShare, and why it needs to be stored per-actor.
     */
    function updateActorShares(
        Data storage dist,
        bytes32 actorId,
        uint shares
    ) internal returns (int changedValue) {
        DistributionActor.Data storage actor = dist.actorInfo[actorId];

        // Compare the current valuePerShare to the valuePerShare at
        // the last time the actor's shares were updated.
        int128 deltaValuePerShare = dist.valuePerShare - actor.lastValuePerShare;

        // use the previous number of shares when calculating the changed amount
        // TODO: Comment or express why shares need to be scaled down by 1e27.
        // TODO: Consider renaming changedValue to deltaActorValue.
        changedValue = (deltaValuePerShare * int(int128(actor.shares))) / 1e27;

        // TODO: Modify shares function parameter type to uint128?
        actor.shares = uint128(shares);

        uint128 deltaActorShares = shares - actor.shares;
        dist.totalShares += deltaActorShares;

        actor.lastValuePerShare = shares == 0 ? int128(0) : dist.valuePerShare;
    }

    /**
     * @dev Upadates an actor's lastValuePerShare to the distribution's current valuePerShare, and
     * returns the total change in value for the actor.
     */
    function accumulateActor(Data storage dist, bytes32 actorId) internal returns (int changedValue) {
        return updateActorShares(dist, actorId, getActorShares(dist, actorId));
    }

    /**
     * @dev Updates an actor's value in the distribution to the specified amount.
     *
     * The incoming value is translated into a number of shares,
     * which modify the total number of shares in the distribution, and thus
     * the distribution's totalValue.
     *
     * Returns the amount by which the distribution's number of shares changed.
     *
     * TODO: Require that lastValuePerShare is zero
     */
    function updateActorValue(
        Data storage dist,
        bytes32 actorId,
        int value
    ) internal returns (uint shares) {
        if (dist.valuePerShare == 0 && dist.totalShares != 0) {
            // TODO: valuePerShare is not a parameter of this function, so why use InvalidParameters?
            revert InvalidParameters("valuePerShare", "shares still exist when no value per share remains");
        }

        // Calculate the number of shares that the
        // change in value produces.

        // If the distribution is empty, set valuePerShare to 1,
        // and the number of shares to the given value.
        if (dist.totalShares == 0) {
            // TODO: Why is 1 = 1e27? - Because its one high precision decimal
            dist.valuePerShare = 1e27;
            // Ensure value is positive.
            shares = uint(value > 0 ? value : -value);
        }
        // If the distribution is not empty, the number of shares
        // is determined by the valuePerShare.
        else {
            // TODO: Why not use value / valuePerShare? -> done this way to avoid losing precision
            shares = uint((value * int128(dist.totalShares)) / totalValue(dist));
        }

        DistributionActor.Data storage actor = dist.actorInfo[actorId];

        actor.shares = uint128(shares);

        uint128 deltaActorShares = shares - actor.shares;
        dist.totalShares += deltaActorShares;

        // Note: No need to udpate actor.lastValuePerShare
        // because they contributed value to the distribution.
    }

    /**
     * @dev Returns the number of shares owned by an actor in the distribution.
     */
    function getActorShares(Data storage dist, bytes32 actorId) internal view returns (uint shares) {
        return dist.actorInfo[actorId].shares;
    }

    /**
     * @dev Returns the value owned by the actor in the distribution.
     *
     * i.e. actor.shares * valuePerShare
     */
    function getActorValue(Data storage dist, bytes32 actorId) internal view returns (int value) {
        return (int(dist.valuePerShare) * int128(dist.actorInfo[actorId].shares)) / 1e27;
    }

    /**
     * @dev Returns the total value held in the distribution.
     *
     * i.e. totalShares * valuePerShare
     *
     * Requirement: this assumes that every user's lastValuePerShare is zero.
     */
    function totalValue(Data storage dist) internal view returns (int value) {
        return (int(dist.valuePerShare) * int128(dist.totalShares)) / 1e27;
    }

    /**
     * @dev Calculates how many shares in this distribution are needed
     * for holding the specified value.
     */
    function sharesForValue(Data storage dist, int value) internal view returns (uint shares) {
        if (int(dist.valuePerShare) * value < 0) {
            revert InvalidParameters("value", "results in negative shares");
        }

        // TODO: Comment or express why shares need to be scaled down by 1e27.
        return uint((value * 1e27) / dist.valuePerShare);
    }
}
