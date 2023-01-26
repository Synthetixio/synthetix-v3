//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "./CrossChainDebtShare.sol";

library DebtShare {
    struct Data {
        // Synthetix c2 DebtShare contract used to determine vote power in the local chain
        IDebtShare debtShareContract;
        // Array of debt share snapshot id's for each epoch
        uint128[] debtShareIds;
        // Array of CrossChainDebtShareData's for each epoch
        CrossChainDebtShare.Data[] crossChainDebtShareData;
    }

    function load() internal pure returns (Data storage debtShare) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.debtshare")) - 1)
            debtShare.slot := 0x24dbf425c80a2b812a860ebf3bf1d082b94299e66be3feb971f862ad0811d2b8
        }
    }
}
