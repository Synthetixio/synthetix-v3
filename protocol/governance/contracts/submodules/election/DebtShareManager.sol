//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/DebtShare.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "./ElectionBase.sol";

/// @dev Tracks user Synthetix v2 debt chains on the local chain at a particular block number
contract DebtShareManager is ElectionBase {
    error DebtShareContractNotSet();
    error DebtShareSnapshotIdNotSet();

    event DebtShareContractSet(address contractAddress);
    event DebtShareSnapshotIdSet(uint snapshotId);

    function _setDebtShareSnapshotId(uint snapshotId) internal {
        DebtShare.Data storage store = DebtShare.load();

        uint currentEpochIndex = Council.load().lastElectionId;
        store.debtShareIds[currentEpochIndex] = uint128(snapshotId);

        emit DebtShareSnapshotIdSet(snapshotId);
    }

    function _getDebtShareSnapshotId() internal view returns (uint) {
        DebtShare.Data storage store = DebtShare.load();

        uint128 debtShareId = store.debtShareIds[Council.load().lastElectionId];
        if (debtShareId == 0) {
            revert DebtShareSnapshotIdNotSet();
        }

        return debtShareId;
    }

    function _setDebtShareContract(address newDebtShareContractAddress) internal {
        DebtShare.Data storage store = DebtShare.load();

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
        DebtShare.Data storage store = DebtShare.load();

        uint128 debtShareId = store.debtShareIds[Council.load().lastElectionId];

        return store.debtShareContract.balanceOfOnPeriod(user, uint(debtShareId));
    }
}
