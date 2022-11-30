//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "./DistributionActor.sol";
import "../errors/ParameterError.sol";

/**
 * @title Data structure that wraps a mapping with a scalar multiplier.
 *
 * If you wanted to modify all the values in a mapping by the same amount, you would normally have to loop through each entry in the mapping. This object allows you to modify all of them at once, by simply modifying the scalar multiplier.
 *
 * I.e. a regular mapping represents values like this:
 * value = mapping[id]
 *
 * And a scalable mapping represents values like this:
 * value = mapping[id] * scalar
 *
 * This reduces the number of computations needed for modifying the balances of N users from O(n) to O(1).

 * Note: Notice how users are tracked by a generic bytes32 id instead of an address. This allows the actors of the mapping not just to be addresses. They can be anything, for example a pool id, an account id, etc.
 *
 * *********************
 * Conceptual Examples
 * *********************
 *
 * 1) Socialization of collateral during a liquidation.
 *
 * Scalable mappings are very useful for "socialization" of collateral, that is, the re-distribution of collateral when an account is liquidated. Suppose 1000 ETH are liquidated, and would need to be distributed amongst 1000 stakers. With a regular mapping, every staker's balance would have to be modified in a loop that iterates through every single one of them. With a scalable mapping, the scalar would simply need to be incremented so that the total value of the mapping increases by 1000 ETH.
 *
 * 2) Socialization of debt during a liquidation.
 *
 * Similar to the socialization of collateral during a liquidation, the debt of the position that is being liquidated can be re-allocated using a scalable mapping with a single action. Supposing a scalable mapping tracks each user's debt in the system, and that 1000 sUSD has to be distributed amongst 1000 stakers, the debt data structure's scalar would simply need to be incremented so that the total value or debt of the distribution increments by 1000 sUSD.
 *
 */
library ScalableMapping {
    using SafeCast for uint128;
    using SafeCast for uint256;
    using SafeCast for int128;
    using SafeCast for int256;
    using DecimalMath for int256;
    using DecimalMath for uint256;

    error InsufficientMappedAmount(int scaleModifier);

    struct Data {
        uint128 totalSharesD18;
        int128 scaleModifierD27;
        mapping(bytes32 => uint) sharesD18;
    }

    /**
     * @dev Inflates or deflates the total value of the distribution by the given value.
     *
     * The value being distributed ultimately modifies the distribution's scaleModifier.
     */
    function scale(Data storage self, int value) internal {
        if (value == 0) {
            return;
        }

        uint totalShares = self.totalSharesD18.uint128toUint256();

        // TODO: Can we safely assume that amount will always be a regular integer,
        // i.e. not a decimal?
        int valueHighPrecision = value * DecimalMath.UNIT_PRECISE_INT;
        int deltaScaleModifier = valueHighPrecision / int(totalShares);

        self.scaleModifierD27 += int128(deltaScaleModifier);

        if (self.scaleModifierD27 < -DecimalMath.UNIT_PRECISE_INT) {
            revert InsufficientMappedAmount(-self.scaleModifierD27);
        }
    }

    /**
     * @dev Updates an actor's individual value in the distribution to the specified amount.
     *
     * The change in value is manifested in the distribution by changing the actor's number of shares in it, and thus the distribution's total number of shares.
     *
     * Returns the resulting amount of shares that the actor has after this change in value.
     */
    function set(
        Data storage self,
        bytes32 actorId,
        uint newActorValue
    ) internal returns (uint resultingShares) {
        // Represent the actor's change in value by changing the actor's number of shares,
        // and keeping the distribution's scaleModifier constant.

        resultingShares = _getSharesForAmount(self, newActorValue);

        // Modify the total shares with the actor's change in shares.
        self.totalSharesD18 = (self.totalSharesD18 + resultingShares - self.sharesD18[actorId]).uint256toUint128();

        self.sharesD18[actorId] = resultingShares.uint256toUint128();
    }

    /**
     * @dev Returns the value owned by the actor in the distribution.
     *
     * i.e. actor.shares * scaleModifier
     */
    function get(Data storage self, bytes32 actorId) internal view returns (uint value) {
        uint totalShares = self.totalSharesD18;
        if (self.totalSharesD18 == 0) {
            return 0;
        }

        return (self.sharesD18[actorId] * totalAmount(self).int256toUint256()) / totalShares;
    }

    /**
     * @dev Returns the total value held in the distribution.
     *
     * i.e. totalShares * scaleModifier
     */
    function totalAmount(Data storage self) internal view returns (int value) {
        return
            int((self.scaleModifierD27 + DecimalMath.UNIT_PRECISE_INT) * self.totalSharesD18.uint128toInt256()) /
            DecimalMath.UNIT_PRECISE_INT;
    }

    function _getSharesForAmount(Data storage self, uint amount) private view returns (uint shares) {
        shares = (amount * DecimalMath.UNIT_PRECISE) / uint(int(self.scaleModifierD27 + DecimalMath.UNIT_INT128)) / 1e9;
    }
}
