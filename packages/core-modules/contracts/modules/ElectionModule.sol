//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../submodules/election/ElectionSchedule.sol";

contract ElectionModule is ElectionSchedule, OwnableMixin {
    error EpochNotEvaluated();

    function initializeElectionModule(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external onlyOwner {
        ElectionStore storage store = _electionStore();

        if (store.currentEpochIndex != 0) {
            revert InitError.AlreadyInitialized();
        }

        store.currentEpochIndex = 1;

        _configureFirstEpoch(epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);
    }

    function adjustEpoch(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external onlyOwner onlyWhileIdle {
        EpochData storage epoch = _getCurrentEpoch();

        // TODO: Validate that the new dates are in the future and/or are close to the initial dates?

        _configureEpoch(epoch, epoch.startDate, epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);
    }

    /* solhint-disable */
    function nominate() external onlyWhileNominating {
        // TODO
    }
    /* solhint-enable */

    /* solhint-disable */
    function withdrawNomination() external onlyWhileNominating {
        // TODO
    }
    /* solhint-enable */

    /* solhint-disable */
    function elect(address[] memory candidates) external onlyWhileVoting {
        // TODO
    }
    /* solhint-enable */

    function evaluate() external onlyWhileEvaluating {
        // TODO

        _getCurrentEpoch().evaluated = true;
    }

    function resolve() external onlyWhileEvaluating {
        if (!isCurrentEpochEvaluated()) {
            revert EpochNotEvaluated();
        }

        // TODO: Shuffle NFTs

        _getCurrentEpoch().resolved = true;

        _configureNextEpoch();

        ElectionStore storage store = _electionStore();
        store.currentEpochIndex = store.currentEpochIndex + 1;
    }
}
