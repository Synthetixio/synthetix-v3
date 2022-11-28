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
 * Actor's lastValuePerShare
 * **************************
 *
 * TODO: Explain why lastValuePerShare needs to be stored for each actor.
 *
 * *********************
 * Usage Modes
 * *********************
 *
 * TODO: This needs more clarification.
 *
 * This object is intended to be used in two different exclusive modes:
 * - Actors enter the distribution by adding value (see updateActorValue()),
 * - Actors enter the distribution without adding value (see updateActorShares()).
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
     * The difference in valuePerShare between updates is used to calculate the actor's individual change in value. This value is calculated as the change in valuePerShare times the number of shares that the actor had before the update.
     *
     * TODO: Consider renaming to updateActorSharesTo(...) so that it is clear that "shares" represents the target amount and not a delta.
     * TODO: Resolve lingering question in the function's body.
     */
    function updateActorShares(
        Data storage dist,
        bytes32 actorId,
        uint shares
    ) internal returns (int changedValue) {
        DistributionActor.Data storage actor = dist.actorInfo[actorId];

        // Compare the current valuePerShare of the distribution to the value it had when the actor's shares were last updated.
        int128 deltaValuePerShare = dist.valuePerShare - actor.lastValuePerShare;

        // Calculate the total change in the actor's value.
        // TODO: Why does this use the actor's previous number of shares and not the change in number of shares?
        int changedValueHighPrecision = deltaValuePerShare * actor.shares.uint128toInt256();
        changedValue = changedValueHighPrecision.fromHighPrecisionDecimalToInteger();

        // Modify the total shares with the actor's change in shares.
        uint128 sharesUint128 = shares.uint256toUint128();
        dist.totalShares = dist.totalShares + sharesUint128 - actor.shares;

        actor.shares = sharesUint128;
        actor.lastValuePerShare = shares == 0 ? int128(0) : dist.valuePerShare;
    }

    /**
     * @dev Updates an actor's individual value in the distribution to the specified amount.
     *
     * The change in value is manifested in the distribution by changing the actor's number of shares in it, and thus the distribution's total number of shares.
     *
     * Returns the amount by which the distribution's number of shares changed.
     *
     * TODO: Consider renaming to updateActorValueTo(...) so that it is clear that "value" represents the target value and not a delta.
     */
    function updateActorValue(
        Data storage dist,
        bytes32 actorId,
        int value
    ) internal returns (uint shares) {
        if (dist.valuePerShare == 0 && dist.totalShares != 0) {
            revert ZeroValuePerShare();
        }

        DistributionActor.Data storage actor = dist.actorInfo[actorId];

        // TODO: Comment on why this means that the distribution is "inconsistent", override
        // why we assume that this function is being called after updateActorShares() was called.
        if (actor.lastValuePerShare != 0) {
            revert InconsistentDistribution();
        }

        // Represent the actor's change in value by changing the actor's number of shares,
        // and keeping the distribution's valuePerShare constant.

        // If the distribution is empty, set valuePerShare to 1.0,
        // and the number of shares to the given value.
        if (dist.totalShares == 0) {
            dist.valuePerShare = DecimalMath.UNIT_PRECISE_INT128;
            shares = (value > 0 ? value : -value).int256toUint256(); // Ensure value is positive
        }
        // If the distribution is not empty, the number of shares
        // is determined by the valuePerShare.
        else {
            // Calculate number of shares this way instead of value / valuePerShare,
            // in order to avoid precision loss.
            shares = uint((value * int128(dist.totalShares)) / totalValue(dist));
        }

        // Modify the total shares with the actor's change in shares.
        dist.totalShares = (dist.totalShares + shares - actor.shares).uint256toUint128();

        actor.shares = (shares).uint256toUint128();
        // Note: No need to update actor.lastValuePerShare
        // because they contributed value to the distribution.
    }

    /**
     * @dev Updates an actor's lastValuePerShare to the distribution's current valuePerShare, and
     * returns the change in value for the actor, since their last update.
     */
    function accumulateActor(Data storage dist, bytes32 actorId) internal returns (int changedValue) {
        return updateActorShares(dist, actorId, getActorShares(dist, actorId));
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
        return (int(dist.valuePerShare) * int128(dist.actorInfo[actorId].shares)).fromHighPrecisionDecimalToInteger();
    }

    /**
     * @dev Returns the total value held in the distribution.
     *
     * i.e. totalShares * valuePerShare
     *
     * Requirement: this assumes that every user's lastValuePerShare is zero.
     */
    function totalValue(Data storage dist) internal view returns (int value) {
        return (int(dist.valuePerShare) * int128(dist.totalShares)).fromHighPrecisionDecimalToInteger();
    }

    /**
     * @dev Calculates how many shares in this distribution are needed
     * for holding the specified value.
     */
    function sharesForValue(Data storage dist, int value) internal view returns (uint shares) {
        if (int(dist.valuePerShare) * value < 0) {
            revert ParameterError.InvalidParameter("value", "results in negative shares");
        }

        return uint(value.toHighPrecisionDecimal() / dist.valuePerShare);
    }
}
