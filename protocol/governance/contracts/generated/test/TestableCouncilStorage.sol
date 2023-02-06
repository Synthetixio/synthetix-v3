//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// run npx hardhat generate-testable to regenerate
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

import { Council } from "../../storage/Council.sol";

contract TestableCouncilStorage {
    function _getInstanceStore() internal pure returns (Council.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableCouncil"));
        assembly {
            data.slot := s
        }
    }

    function Council_set_initialized(bool val) external {
        Council.Data storage store = _getInstanceStore();
        store.initialized = val;
    }

    function Council_get_initialized() external view returns (bool) {
        Council.Data storage store = _getInstanceStore();
        return store.initialized;
    }

    function Council_set_lastElectionId(uint val) external {
        Council.Data storage store = _getInstanceStore();
        store.lastElectionId = val;
    }

    function Council_get_lastElectionId() external view returns (uint) {
        Council.Data storage store = _getInstanceStore();
        return store.lastElectionId;
    }

    function Council_set_councilTokenIds(address idx, uint val) external {
        Council.Data storage store = _getInstanceStore();
        store.councilTokenIds[idx] = val;
    }

    function Council_get_councilTokenIds(address idx) external view returns (uint) {
        Council.Data storage store = _getInstanceStore();
        return store.councilTokenIds[idx];
    }

    function Council_newElection() external returns (uint) {
        Council.Data storage store = _getInstanceStore();
        return Council.newElection(store);
    }

    function Council_getCurrentPeriod() external view returns (Council.ElectionPeriod) {
        Council.Data storage store = _getInstanceStore();
        return Council.getCurrentPeriod(store);
    }

}
