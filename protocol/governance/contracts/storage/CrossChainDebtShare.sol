//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "../interfaces/IDebtShare.sol";

library CrossChainDebtShare {
    struct Data {
        // Synthetix v2 cross chain debt share merkle root
        bytes32 merkleRoot;
        // Cross chain debt share merkle root snapshot blocknumber
        uint256 merkleRootBlockNumber;
        // Cross chain debt shares declared on this chain
        mapping(address => uint256) debtShares;
    }
}
