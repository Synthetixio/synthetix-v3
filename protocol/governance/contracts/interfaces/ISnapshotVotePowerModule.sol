pragma solidity ^0.8.0;
// SPDX-License-Identifier: MIT

interface ISnapshotVotePowerModule {

		error SnapshotAlreadyTaken(uint128 snapshotId);

		error BallotAlreadyPrepared(address voter, uint256 electionId);

    function setSnapshotContract(
        address snapshotContract,
				bool enabled
    ) external;
    function takeVotePowerSnapshot(
        address snapshotContract
    ) external returns (uint128 snapshotId);
		function isSnapshotVotePowerValid(address snapshotContract, uint256 electionId) external view returns (bool);
		function prepareBallotWithSnapshot(address voter, address snapshotContract) external returns (uint256 power);
}
