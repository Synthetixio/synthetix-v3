//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {Council} from "../../storage/Council.sol";
import {BaseElectionModule} from "./BaseElectionModule.sol";

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
