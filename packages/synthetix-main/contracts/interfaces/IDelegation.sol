//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDelegation {
    enum Permission {
        Owner,
        Stake,
        Unstake,
        Mint,
        Burn,
        ClaimRewards,
        ManageLocking,
        Delegate
    }
}
