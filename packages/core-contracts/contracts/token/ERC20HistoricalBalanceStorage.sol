//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC20HistoricalBalanceStorage {
    struct Checkpoint {
        uint32 fromBlock;
        uint256 balance;
    }

    struct Data {
        mapping(address => Checkpoint[]) checkpoints;
        Checkpoint[] totalSupplyCheckpoints;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC20HistoricalBalance"));
        assembly {
            store.slot := s
        }
    }
}
