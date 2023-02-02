//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// run npx hardhat generate-testable to regenerate
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

import { CrossChainDebtShare } from "../../storage/CrossChainDebtShare.sol";

contract TestableCrossChainDebtShareStorage {
    function _getInstanceStore() internal pure returns (CrossChainDebtShare.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableCrossChainDebtShare"));
        assembly {
            data.slot := s
        }
    }

    function CrossChainDebtShare_set_merkleRoot(bytes32 val) external {
        CrossChainDebtShare.Data storage store = _getInstanceStore();
        store.merkleRoot = val;
    }

    function CrossChainDebtShare_get_merkleRoot() external view returns (bytes32) {
        CrossChainDebtShare.Data storage store = _getInstanceStore();
        return store.merkleRoot;
    }

    function CrossChainDebtShare_set_merkleRootBlockNumber(uint val) external {
        CrossChainDebtShare.Data storage store = _getInstanceStore();
        store.merkleRootBlockNumber = val;
    }

    function CrossChainDebtShare_get_merkleRootBlockNumber() external view returns (uint) {
        CrossChainDebtShare.Data storage store = _getInstanceStore();
        return store.merkleRootBlockNumber;
    }

    function CrossChainDebtShare_set_debtShares(address idx, uint val) external {
        CrossChainDebtShare.Data storage store = _getInstanceStore();
        store.debtShares[idx] = val;
    }

    function CrossChainDebtShare_get_debtShares(address idx) external view returns (uint) {
        CrossChainDebtShare.Data storage store = _getInstanceStore();
        return store.debtShares[idx];
    }

}
