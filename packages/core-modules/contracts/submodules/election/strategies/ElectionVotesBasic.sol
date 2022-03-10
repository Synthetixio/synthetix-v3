//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ElectionVotes.sol";

/// @dev Basic placeholder implementation of determining vote power in ElectionModule.cast() - do not use in production!
contract ElectionVotesBasic is ElectionVotes {
    function _getVotePower(address) internal view virtual override returns (uint) {
        return 1;
    }
}
