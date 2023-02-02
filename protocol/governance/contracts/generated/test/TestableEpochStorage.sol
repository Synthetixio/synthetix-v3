//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// run npx hardhat generate-testable to regenerate
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

import { Epoch } from "../../storage/Epoch.sol";

contract TestableEpochStorage {
    function _getInstanceStore() internal pure returns (Epoch.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableEpoch"));
        assembly {
            data.slot := s
        }
    }

    function Epoch_set_startDate(uint64 val) external {
        Epoch.Data storage store = _getInstanceStore();
        store.startDate = val;
    }

    function Epoch_get_startDate() external view returns (uint64) {
        Epoch.Data storage store = _getInstanceStore();
        return store.startDate;
    }

    function Epoch_set_endDate(uint64 val) external {
        Epoch.Data storage store = _getInstanceStore();
        store.endDate = val;
    }

    function Epoch_get_endDate() external view returns (uint64) {
        Epoch.Data storage store = _getInstanceStore();
        return store.endDate;
    }

    function Epoch_set_nominationPeriodStartDate(uint64 val) external {
        Epoch.Data storage store = _getInstanceStore();
        store.nominationPeriodStartDate = val;
    }

    function Epoch_get_nominationPeriodStartDate() external view returns (uint64) {
        Epoch.Data storage store = _getInstanceStore();
        return store.nominationPeriodStartDate;
    }

    function Epoch_set_votingPeriodStartDate(uint64 val) external {
        Epoch.Data storage store = _getInstanceStore();
        store.votingPeriodStartDate = val;
    }

    function Epoch_get_votingPeriodStartDate() external view returns (uint64) {
        Epoch.Data storage store = _getInstanceStore();
        return store.votingPeriodStartDate;
    }

}
