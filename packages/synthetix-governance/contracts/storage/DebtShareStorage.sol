//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "../interfaces/ICrossDomainMessenger.sol";

contract DebtShareStorage {
    struct DebtShareStore {
        // Synthetix c2 DebtShare contract used to determine vote power in the local chain
        IDebtShare debtShareContract;
        // Array of debt share snapshot id's for each epoch
        uint128[] debtShareIds;
        // Array of CrossChainDebtShareData's for each epoch
        CrossChainDebtShareData[] crossChainDebtShareData;
        // Stores the address of the Optimism cross domain messenger on L2
        ICrossDomainMessenger crossDomainMessenger;
    }

    struct CrossChainDebtShareData {
        // Synthetix v2 cross chain debt share merkle root
        bytes32 merkleRoot;
        // Cross chain debt share merkle root snapshot blocknumber
        uint merkleRootBlockNumber;
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
