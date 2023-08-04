pragma solidity ^0.8.0;
// SPDX-License-Identifier: MIT

import "../../interfaces/ISnapshotVotePowerModule.sol";
import "../../interfaces/external/ISnapshotRecord.sol";
import "../../storage/Council.sol";
import "../../storage/SnapshotVotePower.sol";
import "../../storage/Election.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "hardhat/console.sol";

contract SnapshotVotePowerModule is ISnapshotVotePowerModule {
    using SafeCastU256 for uint256;

    function setSnapshotContract(address snapshotContract, bool enabled) external override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Council.ElectionPeriod.Administration);

        Council.Data storage council = Council.load();
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
				if (enabled) {
					snapshotVotePower.validFromEpoch = (council.lastElectionId + 1).to128();
					snapshotVotePower.validToEpoch = 0;
				} else {
					snapshotVotePower.validToEpoch = (council.lastElectionId + 1).to128();
				}
    }

    function takeVotePowerSnapshot(
        address snapshotContract
    ) external override returns (uint128 snapshotId) {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Council.ElectionPeriod.Nomination);
        SnapshotVotePowerEpoch.Data storage snapshotVotePowerEpoch = SnapshotVotePower
            .load(snapshotContract)
            .epochs[Council.load().lastElectionId.to128()];
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

		function getVotePowerSnapshotId(address snapshotContract, uint128 electionId) external view returns (uint128) {
				return SnapshotVotePower.load(snapshotContract).epochs[electionId].snapshotId;
		}

    function prepareBallotWithSnapshot(
        address voter,
        address snapshotContract
    ) external override returns (uint256 power) {
        Council.Data storage council = Council.load();
        Council.onlyInPeriod(Council.ElectionPeriod.Vote);
        uint128 currentEpoch = council.lastElectionId.to128();
        SnapshotVotePower.Data storage snapshotVotePower = SnapshotVotePower.load(snapshotContract);
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
