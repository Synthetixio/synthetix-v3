//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../../interfaces/IElectionModule.sol";
import "../../submodules/election/DebtShareManager.sol";
import "../../submodules/election/CrossChainDebtShareManager.sol";
import "./BaseElectionModule.sol";

/// @title Module for electing a council, represented by a set of NFT holders
/// @notice This extends the base ElectionModule by determining voting power by Synthetix v2 debt share
contract ElectionModule is IElectionModule, BaseElectionModule {
    using SafeCastU256 for uint256;

    error TooManyCandidates();
    error WrongInitializer();

    /// @dev Overloads the BaseElectionModule initializer with an additional parameter for the debt share contract
    function initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodDuration,
        uint64 epochDuration,
        uint64 maxDateAdjustmentTolerance
    ) external override(BaseElectionModule, IElectionModule) {
        OwnableStorage.onlyOwner();

        if (_isInitialized()) {
            return;
        }

        uint64 epochStartDate = block.timestamp.to64();
        uint64 epochEndDate = epochStartDate + (1 days * epochDuration);
        uint64 votingPeriodStartDate = epochEndDate - (1 days * votingPeriodDuration);

        if (nominationPeriodStartDate == 0) {
            nominationPeriodStartDate = votingPeriodStartDate - (1 days * votingPeriodDuration);
        }

        _initOrUpgradeElectionModule(
            firstCouncil,
            epochSeatCount,
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

    // ---------------------------------------
    // Internal
    // ---------------------------------------

    function _sqrt(uint x) internal pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
