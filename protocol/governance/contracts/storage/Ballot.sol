//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library Ballot {
    struct Data {
        // Total accumulated votes in this ballot (needs evaluation)
        uint256 votes;
        // List of candidates in this ballot
        address[] candidates;
        // Vote power added per voter
        mapping(address => uint256) votesByUser;
    }

    function isInitiated(Data storage self) internal view returns (bool) {
        return self.votes > 0;
    }
}
