//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";

/**
 * @title TODO
 */
library VaultEpoch {
    using Distribution for Distribution.Data;
    using MathUtil for uint256;

    struct Data {
        /**
         * @dev
         *
         * Amount of debt which has not been rolled into `consolidatedDebtDist`.
         * Needed to keep track of overall getVaultDebt.
         *
         * TODO: Wut?
         *
         * Buffer for socializations that haven't been consolidated yet
         */
        int128 unclaimedDebt;
        /**
         * @dev Tracks debt for each user.
         */
        Distribution.Data debtDist;
        /**
         * @dev Tracks collateral for each user.
         *
         * TODO: Helps with socialized liquidation of collateral in liquidations.
         */
        Distribution.Data collateralDist;
        /**
         * @dev Tracks usd debt for each user.
         *
         * TODO: What is the difference between USD debt and debt?
         * Probably want to rename.
         * - debtDist is an inbox, holds all the debt since the user's last interaction with the system
         * debtDist can change because of any market change: price changes, (in v2x context price is the only way, in the future, it will be other things, there will be many other things).
         * - consolidatedDebtDist is cumulative - debtDist gets rolled into this when user interacts - could also be a mapping, but like collateral, it is needed for socialization, on a liquidation debt is also socialized - mint/burn directly modify this guy - repay debt affects this too
         *
         * consolidatedDebt? cumulativeDEbt
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
        self.debtDist.distributeValue(debtChange);

        // total debt unfortunately needs to be cached here for liquidations
        self.unclaimedDebt += int128(debtChange);
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
        int newDebt = self.debtDist.accumulateActor(actorId);

        currentDebt += newDebt;

        self.consolidatedDebtDist.updateActorValue(actorId, currentDebt);
        self.unclaimedDebt -= int128(newDebt);
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
        self.debtDist.updateActorShares(actorId, self.collateralDist.getActorShares(actorId).mulDecimal(leverage));
    }

    /**
     * @dev TODO
     *
     * Mainly used by liquidations to know a vaults total debt
     * (only thing?)
     */
    function totalDebt(Data storage self) internal view returns (int) {
        return int(self.unclaimedDebt + self.consolidatedDebtDist.totalValue());
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
