//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "./DistributionActor.sol";
import "../errors/ParameterError.sol";

/**
 * @title This is a central, if not _the_ central object of the system. It reduces the number of computations needed for modifying the balances of N users from O(n) to O(1).
 *
 * *********************
 * High Level Overview
 * *********************
 *
 * Simply put, a distribution can be seen as an address to uint mapping that holds user balances, but with the added functionality of a global scalar that is able to inflate or deflate everyone's balances at once.
 *
 * Regular mapping:
 * mapping(address => uint) balances;
 * user_balance = balances[user_address];
 *
 * Distribution:
 * mapping(bytes32 => uint) shares;
 * uint valuePerShare; // <--- Scalar
 * user_balance = shares[user_id] * valuePerShare;
 *
 * Note 1: Notice how users are tracked by a generic bytes32 id instead of an address. This allows the actors of a distribution not just be addresses. They can be anything, for example a pool id, an account id, etc.
 *
 * Note 2: This is not exactly the variable layout or types for a distribution, but it helps to illustrate its main purpose.
 *
 * *********************
 * Conceptual Examples
 * *********************
 *
 * 1) Socialization of collateral during a liquidation.
 *
 * Distributions are very useful for "socialization" of collateral, that is, the re-distribution of collateral when an account is liquidated. Suppose 1000 ETH are liquidated, and would need to be distributed amongst 1000 stakers. With a regular mapping, every staker's balance would have to be modified in a loop that iterates through every single one of them. With a distribution, the valuePerShare scalar would simply need to be incremented so that the total value of the distribution increases by 1000 ETH.
 *
 * 2) Socialization of debt during a liquidation.
 *
 * Similar to the socialization of collateral during a liquidation, the debt of the position that is being liquidated can be re-allocated using a distribution with a single action. Supposing a distribution tracks each user's debt in the system, and that 1000 sUSD has to be distributed amongst 1000 stakers, the debt distribution's valuePerShare would simply need to be incremented so that the total value or debt of the distribution increments by 1000 sUSD.
 *
 * **************************
 * Distributions Over Time
 * **************************
 *
 * If we wanted to store a distribution over time, we would need to repeatedly store its valuePerShare for a given time interval, as well as an entry for every user of their shares at time t. This is of course not only expensive in terms of gas, but unrealizable because of the nature of smart contracts; they are not constantly running programs, but instead only react to user interaction.
 *
 * Even so, why would we want to store a distribution over time? A very common use case of distributions is asking the question of "how has user A's value changed in the distribution since A's last interaction with the system at time t, given that their number of shares has not changed".
 *
 * Some very simple math answers this question:
 * Since `value = valuePerShare * shares`,
 * then `delta_value = valuePerShare_now * shares - valuePerShare_then * shares`,
 * which is `(valuePerShare_now - valuePerShare_then) * shares`,
 * or just `delta_valuePerShare * shares`.
 *
 * To be able to do this programmatically, all we need to do is store a single variable `lastValuePerShare` for every user, and ensure it is written to every time they interact with the system, or their shares are updated in any way whatsoever.
 *
 * See `getActorValueChange()`, and `DistributionActor.lastValuePerShare`.
 *
 * *********************
 * Usage Modes
 * *********************
 *
 * TODO: This needs more clarification.
 *
 * This object is intended to be used in two different exclusive modes:
 * - Actors enter the distribution by adding value (see setActorValue()),
 * - Actors enter the distribution without adding value (see setActorShares()).
 *
 * *********************
 * Numeric Examples
 * *********************
 *
 * 1) Distribution in which actors enter by adding value (updateActorValue).
 *
 * 1.1) The distribution is initialized with a single actor and a value of 100 USD
 * - shares:
 *   - actor1: 1 (100 USD)
 * - totalShares: 1 (100 USD)
 * - valuePerShare: 100 USD
 * - totalValue: 100 USD
 *
 * 1.2) Another actor enters the distribution with 50 USD of value
 * - shares:
 *   - actor1: 1 (100 USD)
 *   - actor2: 0.5 (50 USD)
 * - totalShares: 1.5 (150 USD)
 * - valuePerShare: 100 USD
 * - totalValue: 150 USD
 *
 * 1.3) 10 new actors enter the distribution with 10 USD value each
 * - shares:
 *   - actor1: 1 (100 USD)
 *   - actor2: 0.5 (50 USD)
 *   - actor3-actor10: 0.1 (10 USD)
 * - totalShares: 2.5 (250 USD)
 * - valuePerShare: 100 USD
 * - totalValue: 250 USD
 *
 * 2) Distribution in which actors enter without adding value (updateActorShares).
 *
 * 2.1) The distribution is initialized with two actors and no value
 * - shares:
 *   - actor1: 1 (0 USD)
 *   - actor2: 1 (0 USD)
 * - totalShares: 2 (0 USD)
 * - valuePerShare: 0 USD
 * - totalValue: 0 USD
 *
 * 2.2) 100 USD of value is distributed (see distributeValue())
 * - shares:
 *   - actor1: 1 (50 USD)
 *   - actor2: 1 (50 USD)
 * - totalShares: 2 (100 USD)
 * - valuePerShare: 50 USD
 * - totalValue: 100 USD
 *
 * 2.3) Actor 1's shares are duplicated
 * - shares:
 *   - actor1: 2 (100 USD)
 *   - actor2: 1 (50 USD)
 * - totalShares: 3 (150 USD)
 * - valuePerShare: 50 USD
 * - totalValue: 150 USD
 *
 * TODO: Initialization of a distribution could be cleaned up, removed from semantically overloaded functions into a clear initializer function. This would clean up the Distribution's two main functions.
 */
library Distribution {
    using SafeCast for uint128;
    using SafeCast for uint256;
    using SafeCast for int128;
    using SafeCast for int256;
    using DecimalMath for int256;

    /**
     * @dev Thrown when an attempt is made to distribute value to a distribution
     * with no shares.
     */
    error EmptyDistribution();
    /**
     * @dev Thrown when an attempt is made to add value to a distribution
     * whose valuePerShare is zero.
     */
    error ZeroValuePerShare();
    /**
     * @dev Thrown when a single distribution is used in the two modes mentioned above.
     */
    error InconsistentDistribution();

    struct Data {
        /**
         * @dev The total number of shares in the distribution.
         */
        uint128 totalShares;
        /**
         * @dev The value per share of the distribution.
         *
         * This is a high precision "decimal" value with 27 decimals of precision. See DecimalMath.
         *
         * 1.0 = 1000000000000000000000000000 (27 zeroes)
         *
         * TODO: Consider using a nomenclature for integers vs decimals vs high precision decimals. E.g:
         * integer => myValue
         * decimal => pMyValue
         * high precision decimal => ppMyValue
         * Why? These representations are constructions on top of regular types (uint, uint128, int128, etc) and the code does not enforce their interoperability in any way, which could lead to mistakes and bugs. The nomenclature might help in this aspect.
         */
        int128 valuePerShare;
        /**
         * @dev Tracks individual actor information, such as how many shares an actor has, their lastValuePerShare, etc.
         */
        mapping(bytes32 => DistributionActor.Data) actorInfo;
    }

    /**
     * @dev Inflates or deflates the total value of the distribution by the given value.
     *
     * The value being distributed ultimately modifies the distribution's valuePerShare.
     */
    function distributeValue(Data storage dist, int value) internal {
        if (value == 0) {
            return;
        }

        uint totalShares = dist.totalShares.uint128toUint256();

        if (totalShares == 0) {
            revert EmptyDistribution();
        }

        // TODO: Can we safely assume that amount will always be a regular integer,
        // i.e. not a decimal?
        int valueHighPrecision = value.toHighPrecisionDecimal();
        int deltaValuePerShare = valueHighPrecision / int(totalShares);

        dist.valuePerShare += int128(deltaValuePerShare);
    }

    /**
     * @dev Updates an actor's number of shares in the distribution to the specified amount.
     *
     * Whenever an actor's shares are changed in this way, we record the distribution's current valuePerShare into the actor's lastValuePerShare record.
     *
     * Note: Consider that calling this function wipes out historical value change data. So, make sure to call `getActorValueChange()` and use this data before calling this function.
     * TODO: Consider reinserting this return value because almost always you NEED to use it.
     */
    function setActorShares(
        Data storage dist,
        bytes32 actorId,
        uint newActorShares
    ) internal {
        DistributionActor.Data storage actor = dist.actorInfo[actorId];

        uint128 sharesUint128 = newActorShares.uint256toUint128();
        dist.totalShares = dist.totalShares + sharesUint128 - actor.shares;

        actor.shares = sharesUint128;

        actor.lastValuePerShare = newActorShares == 0 ? int128(0) : dist.valuePerShare;
    }

    /**
     * @dev Updates an actor's lastValuePerShare to the distribution's current valuePerShare, and
     * returns the change in value for the actor, since their last update.
     */
    function accumulateActor(Data storage dist, bytes32 actorId) internal returns (int valueChange) {
        valueChange = getActorValueChange(dist, actorId);

        // TODO only update lastValuePerShare since we got the valueChange in the line before
        // actor.lastValuePerShare = valuePerShare;
        setActorShares(dist, actorId, getActorShares(dist, actorId));
    }

    /**
     * @dev Calculates the change in value of the actor's shares, according to the current valuePerShare of the distribution, and what this value was the last time the actor's shares were updated.
     */
    function getActorValueChange(Data storage dist, bytes32 actorId) internal view returns (int valueChange) {
        DistributionActor.Data storage actor = dist.actorInfo[actorId];
        int128 deltaValuePerShare = dist.valuePerShare - actor.lastValuePerShare;

        int changedValueHighPrecision = deltaValuePerShare * actor.shares.uint128toInt256();
        valueChange = changedValueHighPrecision.fromHighPrecisionDecimalToInteger();
    }

    /**
     * @dev Returns the number of shares owned by an actor in the distribution.
     */
    function getActorShares(Data storage dist, bytes32 actorId) internal view returns (uint shares) {
        return dist.actorInfo[actorId].shares;
    }
}
