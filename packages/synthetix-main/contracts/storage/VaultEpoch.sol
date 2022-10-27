//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";

/**
 * @title Tracks collateral and debt distributions in a pool, for a specific collateral type, in a given epoch.
 *
 * Collateral is tracked with a distribution as opposed to a regular mapping because liquidations cause collateral to be socialized. If collateral was tracked using a regular mapping, such socialization would be difficult and require looping through individual balances, or some other sort of complex and expensive mechanism. Distributions make socialization easy.
 *
 * Debt is also tracked in a distribution for the same reason, but it is additionally split in two distributions: incoming and consolidated debt.
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
         * E.g. when a given amount of debt is socialized during a liquidation, but it yet hasn't been rolled into
         * the consolidated debt distribution.
         */
        int128 unconsolidatedDebt;
        /**
         * @dev Tracks incoming debt for each user.
         *
         * The value of shares in this distribution change as the associate market changes, i.e. price changes in an asset in
         * a spot market.
         *
         * Also, when debt is socialized in a liquidation, it is done onto this distribution. As users
         * interact with the system, their independent debt is consolidated or rolled into consolidatedDebtDist.
         */
        Distribution.Data incomingDebtDist;
        /**
         * @dev Tracks collateral delegated to this vault, for each user.
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
         * Updated when users interact with the system, consolidating changes from the fluctuating incomingDebtDist,
         * and directly when users mint or burn USD, or repay debt.
         */
        Distribution.Data consolidatedDebtDist;
    }

    /**
     * @dev Converts an account id to an actor id used in Distribution objects.
     *
     * TODO: Consider moving this into a Distribution helper, and use everywhere.
     * Seeing multiple uses of bytes32(uint(uint | address)), in the code.
     */
    function accountToActor(uint128 accountId) internal pure returns (bytes32) {
        return bytes32(uint(accountId));
    }

    /**
     * @dev Updates the value per share of the incoming debt distribution.
     * Used for socialization during liquidations, and to bake in market changes.
     *
     * Called from:
     * - LiquidationModule.liquidate
     * - Pool.recalculateVaultCollateral (ticker)
     */
    function distributeDebt(Data storage self, int debtChange) internal {
        self.incomingDebtDist.distributeValue(debtChange);

        // Cache total debt here.
        // Will roll over to individual users as they interact with the system.
        self.unconsolidatedDebt += int128(debtChange);
    }

    /**
     * @dev Consolidates user debt as they interact with the system.
     *
     * Fluctuating debt is moved from incoming to consolidated debt.
     *
     * Called as a ticker from various parts of the system, usually whenever the
     * real debt of a user needs to be known.
     */
    function consolidateAccountDebt(Data storage self, uint128 accountId) internal returns (int currentDebt) {
        bytes32 actorId = accountToActor(accountId);

        currentDebt = self.consolidatedDebtDist.getActorValue(actorId);
        int newDebt = self.incomingDebtDist.accumulateActor(actorId);

        currentDebt += newDebt;

        self.consolidatedDebtDist.updateActorValue(actorId, currentDebt);
        self.unconsolidatedDebt -= int128(newDebt);
    }

    /**
     * @dev Updates a user's collateral value, and sets their exposure to debt
     * according to the collateral they delegated and the leverage used.
     *
     * Called whenever a user's collateral changes.
     *
     * TODO: Rename to updateAccountCollateralAndDebtExposure?
     */
    function updateAccountPosition(
        Data storage self,
        uint128 accountId,
        uint collateralAmount,
        uint leverage
    ) internal {
        bytes32 actorId = accountToActor(accountId);

        // Ensure account debt is consolidated before we do next things.
        consolidateAccountDebt(self, accountId);

        self.collateralDist.updateActorValue(actorId, int(collateralAmount));
        self.incomingDebtDist.updateActorShares(actorId, self.collateralDist.getActorShares(actorId).mulDecimal(leverage));
    }

    /**
     * @dev Returns the vault's total debt in this epoch, including the debt
     * that hasn't yet been consolidated into individual accounts.
     */
    function totalDebt(Data storage self) internal view returns (int) {
        return int(self.unconsolidatedDebt + self.consolidatedDebtDist.totalValue());
    }

    /**
     * @dev Returns an account's value in the Vault's collateral distribution.
     */
    function getAccountCollateral(Data storage self, uint128 accountId) internal view returns (uint amount) {
        return uint(self.collateralDist.getActorValue(accountToActor(accountId)));
    }
}
