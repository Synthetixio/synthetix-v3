//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SnapshotVotePower} from "../storage/SnapshotVotePower.sol";

interface ISnapshotVotePowerModule {
    error SnapshotAlreadyTaken(uint128 snapshotId);
    error BallotAlreadyPrepared(address voter, uint256 electionId);
    error SnapshotNotTaken(address snapshotContract, uint128 electionId);
    error NoPower(uint256, address);
    error InvalidSnapshotContract();

    function setSnapshotContract(
        address snapshotContract,
        SnapshotVotePower.WeightType weight,
        uint256 scale,
        bool enabled
    ) external;

    function takeVotePowerSnapshot(address snapshotContract) external returns (uint128 snapshotId);

    function prepareBallotWithSnapshot(
        address snapshotContract,
        address voter
    ) external returns (uint256 votingPower);

    function getPreparedBallot(address voter) external view returns (uint256 power);

    function getVotingPowerForUser(
        address snapshotContract,
        address voter,
        uint256 periodId
    ) external view returns (uint256);
}
