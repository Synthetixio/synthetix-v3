//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "./ElectionDebtShareMigrator.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

/// @dev Defines core functionality for recording votes in ElectionModule.cast()
//TODO separar votes, votes1, votes2
abstract contract ElectionVotes is ElectionBase, ElectionDebtShareMigrator {
    using SetUtil for SetUtil.AddressSet;

    function _validateCandidates(address[] calldata candidates) internal virtual {
        uint length = candidates.length;

        if (length == 0) {
            revert NoCandidates();
        }

        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        for (uint i = 0; i < length; i++) {
            address candidate = candidates[i];

            // Reject candidates that are not nominated.
            if (!nominees.contains(candidate)) {
                revert NotNominated();
            }

            // Reject duplicate candidates.
            if (i < length - 1) {
                for (uint j = i + 1; j < length; j++) {
                    address otherCandidate = candidates[j];

                    if (candidate == otherCandidate) {
                        revert DuplicateCandidates();
                    }
                }
            }
        }
    }

    function _recordVote(
        address voter,
        uint votePower,
        address[] calldata candidates
    ) internal virtual returns (bytes32 ballotId) {
        ElectionData storage election = _getCurrentElection();

        ballotId = _calculateBallotId(candidates);
        BallotData storage ballot = _getBallot(ballotId);

        // Initialize ballot if new.
        if (!_ballotExists(ballot)) {
            address[] memory newCandidates = candidates;

            ballot.candidates = newCandidates;

            election.ballotIds.push(ballotId);
        }

        ballot.votes += votePower;
        election.ballotIdsByAddress[voter] = ballotId;

        return ballotId;
    }

    function _withdrawVote(address voter, uint votePower) internal virtual returns (bytes32 ballotId) {
        ElectionData storage election = _getCurrentElection();

        ballotId = election.ballotIdsByAddress[voter];
        BallotData storage ballot = _getBallot(ballotId);

        ballot.votes -= votePower;
        election.ballotIdsByAddress[voter] = bytes32(0);

        return ballotId;
    }

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

    function _getVotePower(address voter) internal view returns (uint) {
        return _getVotePowerL1(voter) + _getVotePowerL2(voter);
    }

    function _getVotePowerL1(address voter) internal view returns (uint) {
        return _getL1DebtShare(voter);
    }

    function _getVotePowerL2(address voter) internal view returns (uint) {
        ElectionStore storage store = _electionStore();

        uint currentEpochIndex = _electionStore().currentEpochIndex;
        uint128 debtShareId = store.debtShareIds[currentEpochIndex];

        return store.debtShareContract.balanceOfOnPeriod(voter, debtShareId);
    }
}
