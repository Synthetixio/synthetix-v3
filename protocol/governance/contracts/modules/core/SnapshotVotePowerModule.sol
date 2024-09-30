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

    event SnapshotContractSet(
        address indexed snapshotContract,
        bool indexed enabled,
        SnapshotVotePower.WeightType weight,
        uint256 scale
    );

    ///@notice Sets a snapshot contract to be used for voting power calculations
    ///@param snapshotContract The address of the snapshot contract
    ///@param weight The weight type to be used for voting power calculations
    ///@param scale The scale to be used for voting power calculations (18 decimals)
    ///@param enabled Whether the snapshot contract is enabled
    function setSnapshotContract(
        address snapshotContract,
        SnapshotVotePower.WeightType weight,
        uint256 scale,
        bool enabled
    ) external override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Administration);

        // if weight is not one of the scaled types scale must be zero and scaled weight types must have non-zero scale
        if (
            (weight == SnapshotVotePower.WeightType.Linear ||
                weight == SnapshotVotePower.WeightType.Sqrt)
                ? scale != 0
                : scale == 0
        ) revert InvalidScale();

        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
        snapshotVotePower.weight = weight;
        snapshotVotePower.scale = scale;
        snapshotVotePower.enabled = enabled;

        emit SnapshotContractSet(snapshotContract, enabled, weight, scale);
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

    /// @dev WARNING: this function is for the frontend to get the voting power of a voter, not for the contract to use
    function getVotingPowerForUser(
        address snapshotContract,
        address voter,
        uint256 periodId
    ) external view override returns (uint256) {
        uint256 snapshotAmount = ISnapshotRecord(snapshotContract).balanceOfOnPeriod(
            voter,
            periodId
        );
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
        return SnapshotVotePower.calculateVotingPower(snapshotVotePower, snapshotAmount);
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

        votingPower = SnapshotVotePower.calculateVotingPower(snapshotVotePower, balance);

        if (votingPower == 0) {
            revert NoPower(snapshotVotePowerEpoch.snapshotId, voter);
        }

        Ballot.Data storage ballot = Ballot.load(currentEpoch, voter, block.chainid);

        ballot.votingPower += votingPower;
        snapshotVotePowerEpoch.recordedVotingPower[voter] = votingPower;
    }

    function getPreparedBallot(address voter) external view override returns (uint256 power) {
        uint128 currentEpoch = Council.load().currentElectionId.to128();
        Ballot.Data storage ballot = Ballot.load(currentEpoch, voter, block.chainid);
        return ballot.votingPower;
    }
}
