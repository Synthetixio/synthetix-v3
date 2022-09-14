//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC20HistoricalBalanceStorage {
    struct Checkpoint {
        uint32 fromBlock;
        uint256 balance;
    }

    struct ERC20HistoricalBalanceStore {
        mapping(address => Checkpoint[]) checkpoints;
        Checkpoint[] totalSupplyCheckpoints;
    }

    function _erc20HistoricalBalanceStore() internal pure returns (ERC20HistoricalBalanceStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.ERC20HistoricalBalance")) - 1)
            store.slot := 0x393eda35c1f9f2ed61beadc91c5bc71460000d96e49875c3538eefc5de97d456
        }
    }
}
