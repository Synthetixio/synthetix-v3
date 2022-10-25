//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";

/**
 * @title Tracks collateral and debt distributions in a pool for a specific collateral type, for a given epoch.
 *
 * Collateral is tracked in a distribution as opposed to in a regular mapping because liquidations cause collateral to be socialized. If collateral was tracked using a regular mapping, such socialization would be difficult and require looping through individual balances, or some other sort of complex and expensive mechanism.
 *
 * Debt is also tracked in a distribution for the same reason, but it is additionally split in two: incoming and consolidated debt.
 *
 * Incoming debt is modified when a liquidations occurs.
 * Consolidated debt is updated when users interact with the system.
 */
library VaultEpoch {
    using Distribution for Distribution.Data;
    using MathUtil for uint256;

    struct Data {
        /**
         * @dev Amount of debt in this Vault that is yet to be consolidated.
         *
         * E.g. when a given amount of debt is socialized during a liquidation, but it yet hasn't been rolled into consolidatedDebtDist.
         */
        int128 unconsolidatedDebt;
        /**
         * @dev Tracks incoming debt for each user.
         *
         * Holds a user's debt since their last interaction with the system.
         *
         * This distribution can change because of any change in a market, most commonly because of the price of an asset changing.
         *
         * Is rolled into or consolidated into consolidatedDebtDist when users interact with the system.
         */
        Distribution.Data incomingDebtDist;
        /**
         * @dev Tracks collateral for each user.
         *
         * Uses a distribution instead of a regular market because of the way collateral is socialized during liquidations.
         *
         * A regular mapping would require looping over the mapping of each account's collateral, or moving the liquidated
         * collateral into a place where it could later be claimed. With a distribution, liquidated collateral can be
         * socialized very easily.
         */
        Distribution.Data collateralDist;
        /**
         * @dev Tracks consolidated debt for each user.
         *
         * Is modified when a user interacts with the system, rolling in or consolidating their incomingDebt into itself.
         *
         * Can also be modified directly when users mint or burn USD, or repay debt.
         *
         * As with collateral tracking, this could also use a regular mapping, but uses a distribution to facilitate
         * socialization of debt during liquidations. See `collateralDist`.
         */
        Distribution.Data consolidatedDebtDist;
    }

    /**
     * @dev Converts an account id to an actor id used in Distribution objects.
     *
     * TODO: Consider moving this into a DistributionMixin, and use everywhere.
     * Seeing multiple uses of bytes32(uint(uint | address)), in the code.
     */
    function accountToActor(uint128 accountId) internal pure returns (bytes32) {
        return bytes32(uint(accountId));
    }

    /**
     * @dev TODO
     *
     * Ticker - called from liquidations
     */
    function distributeDebt(Data storage self, int debtChange) internal {
        self.incomingDebtDist.distributeValue(debtChange);

        // total debt unfortunately needs to be cached here for liquidations
        self.unconsolidatedDebt += int128(debtChange);
    }

    /**
     * @dev TODO
     *
     * Rolls in debt into consolidatedDebt
     *
     * Called as a ticker from quite a few places - needs to be ticked before every time
     * you need to know a user's debt
     */
    function updateAccountDebt(Data storage self, uint128 accountId) internal returns (int currentDebt) {
        bytes32 actorId = accountToActor(accountId);

        currentDebt = self.consolidatedDebtDist.getActorValue(actorId);
        int newDebt = self.incomingDebtDist.accumulateActor(actorId);

        currentDebt += newDebt;

        self.consolidatedDebtDist.updateActorValue(actorId, currentDebt);
        self.unconsolidatedDebt -= int128(newDebt);
    }

    /**
     * @dev TODO
     *
     * Called whenever collateral changes, updates collat dist and rolls debt
     *
     * Modifies exposure to debt - collat * leverage
     */
    function setAccount(
        Data storage self,
        uint128 accountId,
        uint collateralAmount,
        uint leverage
    ) internal {
        bytes32 actorId = accountToActor(accountId);

        // ensure account debt is rolled in before we do next things
        updateAccountDebt(self, accountId);

        self.collateralDist.updateActorValue(actorId, int(collateralAmount));
        self.incomingDebtDist.updateActorShares(actorId, self.collateralDist.getActorShares(actorId).mulDecimal(leverage));
    }

    /**
     * @dev TODO
     *
     * Mainly used by liquidations to know a vaults total debt
     * (only thing?)
     */
    function totalDebt(Data storage self) internal view returns (int) {
        return int(self.unconsolidatedDebt + self.consolidatedDebtDist.totalValue());
    }

    /**
     * @dev Returns an account's value in the Vault's collateral distribution.
     *
     * TODO
     */
    function getAccountCollateral(Data storage self, uint128 accountId) internal view returns (uint amount) {
        return uint(self.collateralDist.getActorValue(accountToActor(accountId)));
    }
}
