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
    error DebtShareSnapshotIdNotSet();

    event DebtShareContractSet(address contractAddress);
    event DebtShareSnapshotIdSet(uint128 snapshotId);

    function _setDebtShareSnapshotId(uint128 snapshotId) internal {
        DebtShareStore storage store = _debtShareStore();

        uint currentEpochIndex = _getCurrentEpochIndex();
        store.debtShareIds[currentEpochIndex] = snapshotId;

        emit DebtShareSnapshotIdSet(snapshotId);
    }

    function _getDebtShareSnapshotId() internal view returns (uint128) {
        DebtShareStore storage store = _debtShareStore();

        uint128 debtShareId = store.debtShareIds[_getCurrentEpochIndex()];
        if (debtShareId == 0) {
            revert DebtShareSnapshotIdNotSet();
        }

        return debtShareId;
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
