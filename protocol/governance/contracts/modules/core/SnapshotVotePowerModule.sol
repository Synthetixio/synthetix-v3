//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ISnapshotVotePowerModule} from "../../interfaces/ISnapshotVotePowerModule.sol";
import {ISnapshotRecord} from "../../interfaces/external/ISnapshotRecord.sol";
import {Council} from "../../storage/Council.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {SnapshotVotePower} from "../../storage/SnapshotVotePower.sol";
import {SnapshotVotePowerEpoch} from "../../storage/SnapshotVotePowerEpoch.sol";

contract SnapshotVotePowerModule is ISnapshotVotePowerModule {
    using SafeCastU256 for uint256;

    function setSnapshotContract(address snapshotContract, bool enabled) external override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Council.ElectionPeriod.Administration);

        Council.Data storage council = Council.load();
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
        if (enabled) {
            snapshotVotePower.validFromEpoch = (council.currentElectionId + 1).to128();
            snapshotVotePower.validToEpoch = 0;
        } else {
            snapshotVotePower.validToEpoch = (council.currentElectionId + 1).to128();
        }
    }

    function takeVotePowerSnapshot(
        address snapshotContract
    ) external override returns (uint128 snapshotId) {
        // TODO: Another note, can remove only owner from takeVotePowerSnapshot,allow takeVotePowerSnapshot to be called in nomination period or election period
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Council.ElectionPeriod.Nomination);
        SnapshotVotePowerEpoch.Data storage snapshotVotePowerEpoch = SnapshotVotePower
            .load(snapshotContract)
            .epochs[Council.load().currentElectionId.to128()];
        if (snapshotVotePowerEpoch.snapshotId > 0) {
            revert SnapshotAlreadyTaken(snapshotVotePowerEpoch.snapshotId);
        }

        snapshotId = block.timestamp.to128();
        ISnapshotRecord(snapshotContract).takeSnapshot(snapshotId);

        snapshotVotePowerEpoch.snapshotId = snapshotId;
    }

    function isSnapshotVotePowerValid(
        address snapshotContract,
        uint256 electionId
    ) external view override returns (bool) {
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
        return
            snapshotVotePower.validFromEpoch <= electionId &&
            (snapshotVotePower.validToEpoch == 0 || snapshotVotePower.validToEpoch > electionId);
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
        // TODO: Let's add also a comment in the prepareBallotWithSnapshot that this is where we'd add quadratic voting support (if we don't plan to add it as an option prior to audit)
        Council.Data storage council = Council.load();
        Council.onlyInPeriod(Council.ElectionPeriod.Vote);
        uint128 currentEpoch = council.currentElectionId.to128();
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);

        if (snapshotVotePower.epochs[currentEpoch].snapshotId == 0) {
            revert SnapshotNotTaken(snapshotContract, currentEpoch);
        }

        power = ISnapshotRecord(snapshotContract).balanceOfOnPeriod(
            voter,
            snapshotVotePower.epochs[currentEpoch].snapshotId
        );

        if (snapshotVotePower.epochs[currentEpoch].recordedVotingPower[voter] > 0) {
            revert BallotAlreadyPrepared(voter, currentEpoch);
        }

        Ballot.Data storage ballot = Ballot.load(currentEpoch, voter, block.chainid);
        ballot.votingPower += power;
        snapshotVotePower.epochs[currentEpoch].recordedVotingPower[voter] = power;
    }
}
