//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../../interfaces/IElectionModule.sol";
import "./BaseElectionModule.sol";

/// @title Module for electing a council, represented by a set of NFT holders
/// @notice This extends the base ElectionModule by determining voting power by Synthetix v2 debt share
contract ElectionModule is IElectionModule, BaseElectionModule {
    using SafeCastU256 for uint256;

    error TooManyCandidates();

    /// @dev Overloads the BaseElectionModule initializer with an additional parameter for the debt share contract
    function updateElectionSettings(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodDuration,
        uint64 epochDuration,
        uint64 maxDateAdjustmentTolerance
    ) external override(BaseElectionModule, IElectionModule) {
        OwnableStorage.onlyOwner();

        uint64 epochStartDate = block.timestamp.to64();
        uint64 epochEndDate = epochStartDate + (1 days * epochDuration);
        uint64 votingPeriodStartDate = epochEndDate - (1 days * votingPeriodDuration);

        if (nominationPeriodStartDate == 0) {
            nominationPeriodStartDate = votingPeriodStartDate - (1 days * votingPeriodDuration);
        }

        _updateElectionSettings(
            firstCouncil,
            minimumActiveMembers,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate,
            maxDateAdjustmentTolerance * 1 days
        );
    }

    /// @dev Overrides the BaseElectionModule nominate function to only allow 1 candidate to be nominated
    function cast(
        address[] calldata candidates,
        uint256[] calldata amounts
    ) public override(BaseElectionModule, IElectionModule) {
        Council.onlyInPeriod(Council.ElectionPeriod.Vote);
        if (candidates.length > 1) {
            revert TooManyCandidates();
        }

        super.cast(candidates, amounts);
    }
}
