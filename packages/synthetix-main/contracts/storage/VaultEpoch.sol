//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";

library VaultEpoch {
    using Distribution for Distribution.Data;

    struct Data {
        /// @dev amount of debt which has not been rolled into `usdDebtDist`. Needed to keep track of overall getVaultDebt
        int128 unclaimedDebt;
        /// @dev if there are liquidations, this value will be multiplied by any share counts to determine the value of the shares wrt the rest of the pool
        uint128 liquidityMultiplier;
        /// @dev tracks debt for each user
        Distribution.Data debtDist;
        /// @dev tracks collateral for each user
        Distribution.Data collateralDist;
        /// @dev tracks usd for each user
        Distribution.Data usdDebtDist;
    }

    function accountToActor(uint128 accountId) internal pure returns (bytes32) {
        return bytes32(uint(accountId));
    }

    function distributeDebt(Data storage self, int debtChange) internal {
        self.debtDist.distribute(debtChange);

        // total debt unfortunately needs to be cached here for liquidations
        self.unclaimedDebt += int128(debtChange);
    }

    function updateAccountDebt(Data storage self, uint128 accountId) internal returns (int currentDebt) {
        bytes32 actorId = accountToActor(accountId);

        currentDebt = self.usdDebtDist.getActorValue(actorId);
        int newDebt = self.debtDist.accumulateActor(actorId);

        currentDebt += newDebt;

        self.usdDebtDist.updateActorValue(actorId, currentDebt);
        self.unclaimedDebt -= int128(newDebt);
    }

    function clearAccount(Data storage self, uint128 accountId) internal {
        bytes32 actorId = accountToActor(accountId);
        self.collateralDist.updateActorShares(actorId, 0);
        self.debtDist.updateActorShares(actorId, 0);
        self.usdDebtDist.updateActorShares(actorId, 0);
    }

    function getAccountCollateral(Data storage self, uint128 accountId) internal view returns (uint amount) {
        return uint(self.collateralDist.getActorValue(accountToActor(accountId)));
    }
}
