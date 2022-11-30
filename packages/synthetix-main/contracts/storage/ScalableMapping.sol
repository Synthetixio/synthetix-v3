//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "./DistributionActor.sol";
import "../errors/ParameterError.sol";

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
        mapping(bytes32 => uint) shares;
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
        int valueHighPrecision = value.toHighPrecisionDecimal();
        int deltascaleModifier = valueHighPrecision / int(totalShares);

        self.scaleModifierD27 += int128(deltascaleModifier);

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
        self.totalSharesD18 = (self.totalSharesD18 + resultingShares - self.shares[actorId]).uint256toUint128();

        self.shares[actorId] = resultingShares.uint256toUint128();
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

        return (self.shares[actorId] * totalAmount(self).int256toUint256()) / totalShares;
    }

    /**
     * @dev Returns the total value held in the distribution.
     *
     * i.e. totalShares * scaleModifier
     *
     * Requirement: this assumes that every user's lastscaleModifier is zero.
     */
    function totalAmount(Data storage self) internal view returns (int value) {
        return
            int((self.scaleModifierD27 + DecimalMath.UNIT_PRECISE_INT) * self.totalSharesD18.uint128toInt256())
                .fromHighPrecisionDecimalToInteger();
    }

    function _getSharesForAmount(Data storage self, uint amount) private view returns (uint shares) {
        shares = amount.toHighPrecisionDecimal() / uint(int(self.scaleModifierD27 + DecimalMath.UNIT_INT128)) / 1e9;
    }
}
