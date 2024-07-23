//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ISnapshotVotePowerModule} from "../../interfaces/ISnapshotVotePowerModule.sol";
import {ISnapshotRecord} from "../../interfaces/external/ISnapshotRecord.sol";
import {Council} from "../../storage/Council.sol";
import {Epoch} from "../../storage/Epoch.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {SnapshotVotePower} from "../../storage/SnapshotVotePower.sol";
import {SnapshotVotePowerEpoch} from "../../storage/SnapshotVotePowerEpoch.sol";

contract SnapshotVotePowerModule is ISnapshotVotePowerModule {
    using SafeCastU256 for uint256;

    function setSnapshotContract(
        address snapshotContract,
        SnapshotVotePower.WeightType weight,
        bool enabled
    ) external override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Administration);

        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
        snapshotVotePower.enabled = enabled;
        snapshotVotePower.weight = weight;
    }

    function takeVotePowerSnapshot(
        address snapshotContract
    ) external override returns (uint128 snapshotId) {
        Council.onlyInPeriods(Epoch.ElectionPeriod.Nomination, Epoch.ElectionPeriod.Vote);

        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
        uint128 electionId = Council.load().currentElectionId.to128();

        if (!snapshotVotePower.enabled) {
            revert InvalidSnapshotContract();
        }

        SnapshotVotePowerEpoch.Data storage snapshotVotePowerEpoch = snapshotVotePower.epochs[
            electionId
        ];

        if (snapshotVotePowerEpoch.snapshotId > 0) {
            revert SnapshotAlreadyTaken(snapshotVotePowerEpoch.snapshotId);
        }

        snapshotId = ISnapshotRecord(snapshotContract).currentPeriodId();
        ISnapshotRecord(snapshotContract).takeSnapshot(block.timestamp.to128());

        snapshotVotePowerEpoch.snapshotId = snapshotId;
    }

    function getVotePowerSnapshotId(
        address snapshotContract,
        uint128 electionId
    ) external view returns (uint128) {
        return SnapshotVotePower.load(snapshotContract).epochs[electionId].snapshotId;
    }

    function prepareBallotWithSnapshot(
        address snapshotContract,
        address voter
    ) external override returns (uint256 votingPower) {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        uint128 currentEpoch = Council.load().currentElectionId.to128();
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);

        if (!snapshotVotePower.enabled) {
            revert InvalidSnapshotContract();
        }

        SnapshotVotePowerEpoch.Data storage snapshotVotePowerEpoch = snapshotVotePower.epochs[
            currentEpoch
        ];

        if (snapshotVotePowerEpoch.snapshotId == 0) {
            revert SnapshotNotTaken(snapshotContract, currentEpoch);
        }

        if (snapshotVotePowerEpoch.recordedVotingPower[voter] > 0) {
            revert BallotAlreadyPrepared(voter, currentEpoch);
        }

        uint256 balance = ISnapshotRecord(snapshotContract).balanceOfOnPeriod(
            voter,
            snapshotVotePowerEpoch.snapshotId
        );

        votingPower = SnapshotVotePower.calculateVotingPower(snapshotVotePower.weight, balance);

        if (votingPower == 0) {
            revert NoPower(snapshotVotePowerEpoch.snapshotId, voter);
        }

        Ballot.Data storage ballot = Ballot.load(currentEpoch, voter, block.chainid);

        ballot.votingPower += votingPower;
        snapshotVotePowerEpoch.recordedVotingPower[voter] = votingPower;
    }
}
