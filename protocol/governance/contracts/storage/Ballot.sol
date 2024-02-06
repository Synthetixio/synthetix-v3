//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Ballot
 * @dev A single vote cast by a address/chainId combination.
 *
 * A ballot goes through a few stages:
 * 1. The ballot is empty and all values are 0
 * 2. The user who wants to vote proves their voting power in an external function, and increases the `votingPower` field as a result
 * 3. Once the user has proven their voting power, they can allocate their power to a set of candidates.
 */
library Ballot {
    error InvalidBallot();

    struct Data {
        uint256 votingPower;
        address[] votedCandidates;
        uint256[] amounts;
    }

    function load(
        uint256 electionId,
        address voter,
        uint256 chainId
    ) internal pure returns (Data storage self) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.governance.Ballot", electionId, voter, chainId)
        );

        assembly {
            self.slot := s
        }
    }

    function hasVoted(Data storage self) internal view returns (bool) {
        return self.votedCandidates.length > 0;
    }

    function isValid(Data storage self) internal view returns (bool) {
        if (self.votedCandidates.length != self.amounts.length) {
            return false;
        }

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < self.votedCandidates.length; i++) {
            if (self.amounts[i] == 0) {
                return false;
            }
            totalAmount += self.amounts[i];
        }

        return totalAmount == 0 || totalAmount == self.votingPower;
    }

    function validate(Data storage self) internal view {
        if (!isValid(self)) {
            revert InvalidBallot();
        }
    }
}
