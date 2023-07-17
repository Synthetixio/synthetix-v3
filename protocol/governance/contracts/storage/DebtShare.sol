//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "../interfaces/IDebtShare.sol";
import "./CrossChainDebtShare.sol";

library DebtShare {
    bytes32 private constant _SLOT_DEBT_SHARE_STORAGE =
        keccak256(abi.encode("io.synthetix.governance.DebtShare"));

    struct Data {
        // Synthetix c2 DebtShare contract used to determine vote power in the local chain
        IDebtShare debtShareContract;
        // debt share snapshot id's for each epoch
        mapping(uint => uint128) debtShareIds;
        // CrossChainDebtShareData's for each epoch
        mapping(uint => CrossChainDebtShare.Data) crossChainDebtShareData;
    }

    function load() internal pure returns (Data storage debtShare) {
        bytes32 s = _SLOT_DEBT_SHARE_STORAGE;
        assembly {
            debtShare.slot := s
        }
    }
}
