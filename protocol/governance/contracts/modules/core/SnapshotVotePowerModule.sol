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

    function setSnapshotContract(address snapshotContract, bool enabled) external override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Administration);

        SnapshotVotePower.load(snapshotContract).enabled = enabled;
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

        SnapshotVotePowerEpoch.Data storage epochData = snapshotVotePower.epochs[electionId];

        if (epochData.snapshotId > 0) {
            revert SnapshotAlreadyTaken(epochData.snapshotId);
        }

        uint128 createdAt = block.timestamp.to128();
        snapshotId = ISnapshotRecord(snapshotContract).currentPeriodId();
        ISnapshotRecord(snapshotContract).takeSnapshot(createdAt);

        epochData.snapshotId = snapshotId;
        epochData.createdAt = createdAt;
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
    ) external override returns (uint256 power) {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        uint128 currentEpoch = Council.load().currentElectionId.to128();
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);

        if (!snapshotVotePower.enabled) {
            revert InvalidSnapshotContract();
        }

        SnapshotVotePowerEpoch.Data storage epochData = snapshotVotePower.epochs[currentEpoch];

        if (epochData.snapshotId == 0) {
            revert SnapshotNotTaken(snapshotContract, currentEpoch);
        }

        // We need to not allow the takeVotePowerSnapshot & prepareBallotWithSnapshot methods
        // to not be called on the same tx/block so the user cannot augment voting power with flashloans
        if (epochData.createdAt <= block.timestamp.to128()) {
            revert SnapshotUnavailable();
        }

        power = ISnapshotRecord(snapshotContract).balanceOfOnPeriod(voter, epochData.snapshotId);

        if (power == 0) {
            revert NoPower(epochData.snapshotId, voter);
        }

        if (epochData.recordedVotingPower[voter] > 0) {
            revert BallotAlreadyPrepared(voter, currentEpoch);
        }

        Ballot.Data storage ballot = Ballot.load(currentEpoch, voter, block.chainid);
        ballot.votingPower += power;
        epochData.recordedVotingPower[voter] = power;
    }
}
