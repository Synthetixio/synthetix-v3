//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/DebtShareStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "@synthetixio/core-modules/contracts/submodules/election/ElectionBase.sol";

/// @dev Tracks user Synthetix v2 debt chains on the local chain at a particular block number
contract DebtShareManager is ElectionBase, DebtShareStorage {
    error DebtShareContractNotSet();

    event DebtShareContractSet(address debtShareContractAddress);
    event DebtShareSnapshotTaken(uint128 snapshotId);

    function _takeDebtShareSnapshotOnFirstNomination() internal {
        DebtShareStore storage store = _debtShareStore();

        IDebtShare debtShareContract = store.debtShareContract;

        // Skip if we already have a debt share snapshot for this epoch
        uint currentEpochIndex = _getCurrentEpochIndex();
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
        DebtShareStore storage store = _debtShareStore();

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

    function _getDebtShare(address user) internal view returns (uint) {
        DebtShareStore storage store = _debtShareStore();

        uint128 debtShareId = store.debtShareIds[_getCurrentEpochIndex()];

        return store.debtShareContract.balanceOfOnPeriod(user, debtShareId);
    }
}
