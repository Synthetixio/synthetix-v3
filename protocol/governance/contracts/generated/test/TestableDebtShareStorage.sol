//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// run npx hardhat generate-testable to regenerate
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

import { DebtShare } from "../../storage/DebtShare.sol";

contract TestableDebtShareStorage {
    function _getInstanceStore() internal pure returns (DebtShare.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableDebtShare"));
        assembly {
            data.slot := s
        }
    }

    function DebtShare_set_debtShareIds(uint idx, uint128 val) external {
        DebtShare.Data storage store = _getInstanceStore();
        store.debtShareIds[idx] = val;
    }

    function DebtShare_get_debtShareIds(uint idx) external view returns (uint128) {
        DebtShare.Data storage store = _getInstanceStore();
        return store.debtShareIds[idx];
    }

}
