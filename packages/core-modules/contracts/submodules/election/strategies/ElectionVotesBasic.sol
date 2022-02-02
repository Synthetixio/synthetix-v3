//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ElectionVotes.sol";

contract ElectionVotesBasic is ElectionVotes {
    function _getVotePower(address) internal view virtual override returns (uint) {
        return 1;
    }
}
