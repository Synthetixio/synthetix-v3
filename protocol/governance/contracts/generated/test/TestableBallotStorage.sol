//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// run npx hardhat generate-testable to regenerate
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

import { Ballot } from "../../storage/Ballot.sol";

contract TestableBallotStorage {
    function _getInstanceStore() internal pure returns (Ballot.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableBallot"));
        assembly {
            data.slot := s
        }
    }

    function Ballot_set_votes(uint val) external {
        Ballot.Data storage store = _getInstanceStore();
        store.votes = val;
    }

    function Ballot_get_votes() external view returns (uint) {
        Ballot.Data storage store = _getInstanceStore();
        return store.votes;
    }

    function Ballot_set_candidates(uint idx, address val) external {
        Ballot.Data storage store = _getInstanceStore();
        store.candidates[idx] = val;
    }

    function Ballot_get_candidates(uint idx) external view returns (address) {
        Ballot.Data storage store = _getInstanceStore();
        return store.candidates[idx];
    }

    function Ballot_set_votesByUser(address idx, uint val) external {
        Ballot.Data storage store = _getInstanceStore();
        store.votesByUser[idx] = val;
    }

    function Ballot_get_votesByUser(address idx) external view returns (uint) {
        Ballot.Data storage store = _getInstanceStore();
        return store.votesByUser[idx];
    }

    function Ballot_isInitiated() external view returns (bool) {
        Ballot.Data storage store = _getInstanceStore();
        return Ballot.isInitiated(store);
    }

}
