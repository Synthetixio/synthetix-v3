//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// run npx hardhat generate-testable to regenerate
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

import { Election } from "../../storage/Election.sol";

contract TestableElectionStorage {
    function _getInstanceStore(uint _load_id) internal pure returns (Election.Data storage) {
        return Election.load(_load_id);
    }

    function Election_set_evaluated(uint _load_id, bool val) external {
        Election.Data storage store = _getInstanceStore(_load_id);
        store.evaluated = val;
    }

    function Election_get_evaluated(uint _load_id) external view returns (bool) {
        Election.Data storage store = _getInstanceStore(_load_id);
        return store.evaluated;
    }

    function Election_set_resolved(uint _load_id, bool val) external {
        Election.Data storage store = _getInstanceStore(_load_id);
        store.resolved = val;
    }

    function Election_get_resolved(uint _load_id) external view returns (bool) {
        Election.Data storage store = _getInstanceStore(_load_id);
        return store.resolved;
    }

    function Election_set_numEvaluatedBallots(uint _load_id, uint val) external {
        Election.Data storage store = _getInstanceStore(_load_id);
        store.numEvaluatedBallots = val;
    }

    function Election_get_numEvaluatedBallots(uint _load_id) external view returns (uint) {
        Election.Data storage store = _getInstanceStore(_load_id);
        return store.numEvaluatedBallots;
    }

    function Election_set_ballotIds(uint _load_id, uint idx, bytes32 val) external {
        Election.Data storage store = _getInstanceStore(_load_id);
        store.ballotIds[idx] = val;
    }

    function Election_get_ballotIds(uint _load_id, uint idx) external view returns (bytes32) {
        Election.Data storage store = _getInstanceStore(_load_id);
        return store.ballotIds[idx];
    }

    function Election_set_ballotIdsByAddress(uint _load_id, address idx, bytes32 val) external {
        Election.Data storage store = _getInstanceStore(_load_id);
        store.ballotIdsByAddress[idx] = val;
    }

    function Election_get_ballotIdsByAddress(uint _load_id, address idx) external view returns (bytes32) {
        Election.Data storage store = _getInstanceStore(_load_id);
        return store.ballotIdsByAddress[idx];
    }

    function Election_set_candidateVotes(uint _load_id, address idx, uint val) external {
        Election.Data storage store = _getInstanceStore(_load_id);
        store.candidateVotes[idx] = val;
    }

    function Election_get_candidateVotes(uint _load_id, address idx) external view returns (uint) {
        Election.Data storage store = _getInstanceStore(_load_id);
        return store.candidateVotes[idx];
    }

}
