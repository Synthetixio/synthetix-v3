//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

/// @dev Defines specific L2 ElectionVotes functionalities
contract ElectionVotesL2 is ElectionBase {
    function _takeDebtShareSnapshotOnFirstNomination() internal {
        ElectionStore storage store = _electionStore();

        IDebtShare debtShareContract = store.debtShareContract;

        // Skip if we already have a debt share snapshot for this epoch
        uint currentEpochIndex = _electionStore().currentEpochIndex;
        uint debtShareId = store.debtShareIds[currentEpochIndex];
        if (debtShareId != 0) {
            return;
        }

        // Take new debt share snapshot for this epoch
        uint128 currentDebtSharePeriodId = debtShareContract.currentPeriodId();
        uint128 nextDebtSharePeriodId = currentDebtSharePeriodId + 1;
        debtShareContract.takeSnapshot(nextDebtSharePeriodId);
        store.debtShareIds[currentEpochIndex] = nextDebtSharePeriodId;

        emit DebtShareSnapshotTaken(nextDebtSharePeriodId);
    }

    function _setDebtShareContract(address newDebtShareContractAddress) internal {
        ElectionStore storage store = _electionStore();

        if (newDebtShareContractAddress == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (newDebtShareContractAddress == address(store.debtShareContract)) {
            revert ChangeError.NoChange();
        }

        if (!AddressUtil.isContract(newDebtShareContractAddress)) {
            revert AddressError.NotAContract(newDebtShareContractAddress);
        }

        store.debtShareContract = IDebtShare(newDebtShareContractAddress);
    }

    function _getVotePowerL2(address voter) internal view returns (uint) {
        ElectionStore storage store = _electionStore();

        uint currentEpochIndex = _electionStore().currentEpochIndex;
        uint128 debtShareId = store.debtShareIds[currentEpochIndex];

        return store.debtShareContract.balanceOfOnPeriod(voter, debtShareId);
    }
}
