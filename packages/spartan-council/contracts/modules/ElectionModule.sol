//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as ElectionModuleBase} from "@synthetixio/core-modules/contracts/submodules/election/ElectionModule.sol";
import "@synthetixio/core-modules/contracts/submodules/election/strategies/ElectionTallyPlurality.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "../interfaces/IDebtShare.sol";
import "../storage/SpartanCouncilStorage.sol";
import "./DebtShareMigrator.sol";

contract ElectionModule is ElectionModuleBase, SpartanCouncilStorage, DebtShareMigrator, ElectionTallyPlurality {
    event DebtShareContractSet(address debtShareContractAddress);
    event DebtShareSnapshotTaken(uint128 snapshotId);

    error DebtShareContractNotSet();

    function setDebtShareContract(address newDebtShareContractAddress)
        external
        onlyOwner
        onlyInPeriod(ElectionPeriod.Administration)
    {
        if (newDebtShareContractAddress == address(0)) {
            revert AddressError.ZeroAddress();
        }

        _spartanCouncilStore().debtShareContract = IDebtShare(newDebtShareContractAddress);

        emit DebtShareContractSet(newDebtShareContractAddress);
    }

    function getDebtShareContract() external view returns (address) {
        return address(_spartanCouncilStore().debtShareContract);
    }

    function nominate() public virtual override onlyInPeriod(ElectionPeriod.Nomination) {
        _takeDebtShareSnapshotOnFirstNomination();

        super.nominate();
    }

    function _takeDebtShareSnapshotOnFirstNomination() internal {
        SpartanCouncilStore storage store = _spartanCouncilStore();

        IDebtShare debtShareContract = store.debtShareContract;
        if (address(debtShareContract) == address(0)) {
            revert DebtShareContractNotSet();
        }

        // Skip if we already have a debt share snapshot for this epoch
        uint currentPeriodIndex = _electionStore().currentEpochIndex;
        uint debtShareId = store.debtShareIds[currentPeriodIndex];
        if (debtShareId != 0) {
            return;
        }

        // Take new debt share snapshot for this epoch
        uint128 currentPeriodId = debtShareContract.currentPeriodId();
        uint128 nextPeriodId = currentPeriodId + 1;
        debtShareContract.takeSnapshot(nextPeriodId);
        store.debtShareIds[currentPeriodIndex] = nextPeriodId;

        emit DebtShareSnapshotTaken(nextPeriodId);
    }

    function _getVotePower(address voter) internal view virtual override returns (uint) {
        return _getVotePowerL1(voter) + _getVotePowerL2(voter);
    }

    function _getVotePowerL1(address voter) internal view returns (uint) {
        return (getL1DebtShare(voter));
    }

    function _getVotePowerL2(address voter) internal view returns (uint) {
        SpartanCouncilStore storage store = _spartanCouncilStore();

        uint128 debtShareId = store.debtShareIds[_electionStore().currentEpochIndex];

        return store.debtShareContract.balanceOfOnPeriod(voter, debtShareId);
    }
}
