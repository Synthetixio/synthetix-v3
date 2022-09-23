//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";

import "hardhat/console.sol";

library VaultEpoch {
    using Distribution for Distribution.Data;

    using MathUtil for uint256;

    error InvalidParameters(string incorrectParameter, string help);

    struct Data {
        /// @dev amount of debt which has not been rolled into `usdDebtDist`. Needed to keep track of overall getVaultDebt
        int128 unclaimedDebt;
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

    function setAccount(Data storage self, uint128 accountId, uint collateralAmount, uint leverage) internal {
        bytes32 actorId = accountToActor(accountId);

        // ensure account debt is rolled in before we do next things
        updateAccountDebt(self, accountId);

        console.log("SET ACCOUNT", collateralAmount);

        self.collateralDist.updateActorValue(actorId, int(collateralAmount));
        self.debtDist.updateActorShares(actorId, self.collateralDist.getActorShares(actorId).mulDecimal(leverage));

        console.log("GOT SHARES", self.debtDist.totalShares);
    }

    function totalDebt(Data storage self) internal view returns (int) {
        return int(self.unclaimedDebt + self.usdDebtDist.totalValue());
    }

    function getAccountCollateral(Data storage self, uint128 accountId) internal view returns (uint amount) {
        return uint(self.collateralDist.getActorValue(accountToActor(accountId)));
    }
}
