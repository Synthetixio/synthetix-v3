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
         * @dev Amount of debt which has not been rolled into `usdDebtDist`.
         * Needed to keep track of overall getVaultDebt.
         *
         * TODO: Wut?
         */
        int128 unclaimedDebt;
        /**
         * @dev Tracks debt for each user.
         */
        Distribution.Data debtDist;
        /**
         * @dev Tracks collateral for each user.
         */
        Distribution.Data collateralDist;
        /**
         * @dev Tracks usd debt for each user.
         *
         * TODO: What is the difference between USD debt and debt?
         */
        Distribution.Data usdDebtDist;
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
     */
    function distributeDebt(Data storage self, int debtChange) internal {
        self.debtDist.distributeValue(debtChange);

        // total debt unfortunately needs to be cached here for liquidations
        self.unclaimedDebt += int128(debtChange);
    }

    /**
     * @dev TODO
     */
    function updateAccountDebt(Data storage self, uint128 accountId) internal returns (int currentDebt) {
        bytes32 actorId = accountToActor(accountId);

        currentDebt = self.usdDebtDist.getActorValue(actorId);
        int newDebt = self.debtDist.accumulateActor(actorId);

        currentDebt += newDebt;

        self.usdDebtDist.updateActorValue(actorId, currentDebt);
        self.unclaimedDebt -= int128(newDebt);
    }

    /**
     * @dev TODO
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
     */
    function totalDebt(Data storage self) internal view returns (int) {
        return int(self.unclaimedDebt + self.usdDebtDist.totalValue());
    }

    /**
     * @dev Returns an account's value in the Vault's collateral distribution.
     *
     * TODO: What does this mean?
     */
    function getAccountCollateral(Data storage self, uint128 accountId) internal view returns (uint amount) {
        return uint(self.collateralDist.getActorValue(accountToActor(accountId)));
    }
}
