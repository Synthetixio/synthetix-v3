//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract DebtShareStorage {
    struct DebtShareStore {
        // Debt share contract used to determine vote power
        IDebtShare debtShareContract;
        // Debt share snapshot id by epoch index
        mapping(uint => uint128) debtShareIds;
        // Cross chain debt share data by epoch index
        mapping(uint => CrossChainDebtShareData) crossChainDebtShareData;
    }

    struct CrossChainDebtShareData {
        // Cross chain debt share merkle root
        bytes32 merkleRoot;
        // Cross chain debt share merkle root snapshot blocknumber
        uint merkleRootBlocknumber;
        // Cross chain debt shares declared on this chain
        mapping(address => uint) debtShares;
    }

    function _debtShareStore() internal pure returns (DebtShareStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.debtshare")) - 1)
            store.slot := 0x24dbf425c80a2b812a860ebf3bf1d082b94299e66be3feb971f862ad0811d2b8
        }
    }
}
