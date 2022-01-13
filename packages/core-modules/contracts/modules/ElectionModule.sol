//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../submodules/election/ElectionSchedule.sol";
import "../interfaces/IElectionModule.sol";

contract ElectionModule is IElectionModule, ElectionSchedule, OwnableMixin {
    error EpochNotEvaluated();

    function initializeElectionModule(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external override onlyOwner {
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
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Idle) {
        EpochData storage epoch = _getCurrentEpoch();

        // TODO: Validate that the new dates are in the future and/or are close to the initial dates?

        _configureEpoch(epoch, epoch.startDate, epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);
    }

    /* solhint-disable */
    function nominate() external override onlyInPeriod(ElectionPeriod.Nomination) {
        // TODO
    }

    /* solhint-enable */

    /* solhint-disable */
    function withdrawNomination() external override onlyInPeriod(ElectionPeriod.Nomination) {
        // TODO
    }

    /* solhint-enable */

    /* solhint-disable */
    function elect(address[] memory candidates) external override onlyInPeriod(ElectionPeriod.Vote) {
        // TODO
    }

    /* solhint-enable */

    function evaluate() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        // TODO

        _getCurrentEpoch().evaluated = true;
    }

    function resolve() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (!isEpochEvaluated()) {
            revert EpochNotEvaluated();
        }

        // TODO: Shuffle NFTs

        _getCurrentEpoch().resolved = true;

        _configureNextEpoch();

        ElectionStore storage store = _electionStore();
        store.currentEpochIndex = store.currentEpochIndex + 1;
    }

    function getCurrentPeriod() public view override returns (uint) {
        return uint(_getCurrentPeriod());
    }

    function getEpochIndex() public view override returns (uint) {
        return _electionStore().currentEpochIndex;
    }

    function getEpochStartDate() public view override returns (uint64) {
        return _getCurrentEpoch().startDate;
    }

    function getEpochEndDate() public view override returns (uint64) {
        return _getCurrentEpoch().endDate;
    }

    function getNominationPeriodStartDate() public view override returns (uint64) {
        return _getCurrentEpoch().nominationPeriodStartDate;
    }

    function getVotingPeriodStartDate() public view override returns (uint64) {
        return _getCurrentEpoch().votingPeriodStartDate;
    }

    function isEpochEvaluated() public view override returns (bool) {
        return _getCurrentEpoch().evaluated;
    }
}
