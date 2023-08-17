//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../../interfaces/IElectionModule.sol";
import "./BaseElectionModule.sol";

/// @title Module for electing a council, represented by a set of NFT holders
contract ElectionModule is IElectionModule, BaseElectionModule {
    using SafeCastU256 for uint256;

    error TooManyCandidates();

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
